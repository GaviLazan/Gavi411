import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import MessageThread from "../components/MessageThread";
import { statusLabel as labelize } from "./RequestList";
// This page reuses ReviewSummary's .review-row/.review-label/.review-value
// classes for its own read-only rows — imported directly (Sibling review
// finding: it used to only work by relying on NewRequest.jsx importing
// this CSS first into the same eagerly-bundled app).
import "../components/ReviewSummary.css";
// Same reasoning for the compose textarea's .field-input class (G411-25
// Sibling review finding — same bug class as above, caught again):
// Input.css was only ever loaded as a side effect of NewRequest.jsx
// importing Input.jsx first.
import "../components/Input.css";
import { getConversationKey, encryptMessageContent, decryptMessageContent } from "../lib/conversationCrypto";
import { createAndUploadKeypair } from "../lib/escrow";

// Request detail / "ticket" page (G411-75). Minimum scope per the ticket:
// the request's own fields + urgency/status + the existing Message thread
// (schema's supported it since G411-67, never rendered anywhere until now).
// Real thread UI + compose box landed in G411-25 (MessageThread.jsx).

// typeDetails' keys are freeform per-type (TravelFields/PurchaseFields/
// TechSupportFields), no shared spec list like ReviewSummary.jsx's — that
// file's SPECS constants are review-screen-only (paired with edit
// controls this read-only page doesn't have). Camel-case keys get the
// same word-split treatment as status/type instead of a hand-maintained
// label map, since this page's job is "show whatever was saved," not
// per-type-tuned copy.
function fieldLabel(key) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced[0].toUpperCase() + spaced.slice(1);
}

function typeDetailRows(details, keyPrefix = "") {
  if (!details || typeof details !== "object") return [];
  return Object.entries(details).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.flatMap((entry, i) => typeDetailRows(entry, `${keyPrefix}${key} ${i + 1} — `));
    }
    if (typeof value === "object") {
      return typeDetailRows(value, `${keyPrefix}${fieldLabel(key)} — `);
    }
    return (
      <div className="review-row" key={keyPrefix + key}>
        <span className="review-label">{keyPrefix}{fieldLabel(key)}</span>
        <span className="review-value" dir="auto">{String(value)}</span>
      </div>
    );
  });
}

// Kept in sync by hand with server/lib/cloudinary.js's ALLOWED_IMAGE_TYPES
// (Sibling review finding) — client and server are separate deploy
// targets (Vercel/Render) with no shared package, so a real import isn't
// available; this is only a UI hint anyway (accept doesn't enforce
// anything), the server's own check stays authoritative either way.
const IMAGE_ACCEPT = "image/gif,image/jpeg,image/png,image/heic,image/webp";

function RequestDetail({ requestId, onBack }) {
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(""); // load failure — replaces the whole page
  const [sendError, setSendError] = useState(""); // send failure — inline, thread stays visible
  // True specifically when the send failed because THIS device has no
  // keypair (not any other send failure) — drives whether the recovery
  // button below renders. A dedicated flag rather than string-matching
  // sendError's text, which is fragile against future copy changes.
  const [needsKeypair, setNeedsKeypair] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [image, setImage] = useState(null); // File | null (G411-26)
  const fileInputRef = useRef(null);
  // G411-82: `request.message` rows can be a mix of legacy plaintext and
  // new encrypted ones — decryptedMessages is the render-ready version
  // MessageThread actually gets, decrypted client-side. Kept as separate
  // state (not computed inline in JSX) because decryption is async.
  const [decryptedMessages, setDecryptedMessages] = useState([]);
  // Distinguishes "genuinely no messages" from "haven't decrypted the
  // first batch yet" — without this, MessageThread briefly renders "No
  // messages yet." on every load before the async decrypt effect below
  // resolves, even when the thread has real messages (Sibling review
  // finding, second round).
  const [decrypting, setDecrypting] = useState(true);
  // Self-service recovery for a regular (non-admin) user whose keypair
  // never got generated/uploaded — sendMessage()'s blocking error below
  // is where this is actually hit, so the fix lives right next to it,
  // not tucked away on the admin-only InviteAdmin.jsx screen (Sibling
  // review finding, second round — createAndUploadKeypair() itself was
  // already generic, just never offered to a regular user anywhere).
  const [keypairStatus, setKeypairStatus] = useState("idle"); // 'idle' | 'working' | 'error'

  // One object URL per `image`, not recreated on every render (Sibling
  // review finding: was called inline in JSX, leaking a new blob URL on
  // every keystroke in the draft textarea). Revoked on change/unmount.
  const imagePreviewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    setRequest(null);
    setError("");

    fetch(`/api/requests/${requestId}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setRequest(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this request.");
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // G411-82: derive the conversation's shared key once per requestId/
  // message-set change, decrypt every row. A message that fails to
  // decrypt (wrong/missing key, corrupt envelope) renders a visible
  // placeholder instead of crashing the whole thread — one bad row
  // shouldn't hide the rest of the conversation.
  useEffect(() => {
    let cancelled = false;
    if (!request?.message) {
      setDecryptedMessages([]);
      setDecrypting(false);
      return;
    }

    setDecrypting(true);
    getConversationKey(requestId)
      .then(async (sharedKey) => {
        const resolved = await Promise.all(
          request.message.map(async (m) => {
            try {
              const content = await decryptMessageContent(sharedKey, m);
              return { ...m, content: content ?? "[Unable to decrypt — device not set up yet]" };
            } catch {
              return { ...m, content: "[Unable to decrypt this message]" };
            }
          })
        );
        if (!cancelled) setDecryptedMessages(resolved);
      })
      // getConversationKey can reject (IndexedDB error, network failure
      // fetching /public-keys, a malformed key throwing in crypto.subtle)
      // rather than just resolving null — previously unhandled, which
      // left decryptedMessages stuck at [] forever with no error shown,
      // silently rendering "No messages yet." over a real thread
      // (Sibling review finding, second round).
      .catch(() => {
        if (!cancelled) setDecryptedMessages([]);
      })
      .finally(() => {
        if (!cancelled) setDecrypting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestId, request?.message]);

  async function handleGenerateKeypair() {
    setKeypairStatus("working");
    const ok = await createAndUploadKeypair();
    setKeypairStatus(ok ? "idle" : "error");
    if (ok) {
      setSendError(""); // clear the stale "device isn't set up" message
      setNeedsKeypair(false);
    }
  }

  function refetch() {
    fetch(`/api/requests/${requestId}`)
      .then((res) => res.json())
      .then(setRequest);
  }

  // G411-82: text is encrypted client-side before it ever reaches the
  // server, via the shared key derived from the other party's public
  // key. A sender with no keypair yet (see prisma/schema.prisma's
  // User.publicKey doc comment — a test/dev account created directly,
  // never through a real invite-signup) or whose conversation partner
  // has no public key yet gets a clear, blocking error instead of a
  // silent plaintext fallback — this app has no "device recovery" path
  // that makes plaintext an acceptable substitute, so it's not offered
  // as an option. Image bytes stay unencrypted (see conversationCrypto.js
  // module doc / HANDOFF.md for why — Cloudinary needs to read the file
  // to host it, and this ticket's priority is text).
  async function sendMessage() {
    if (!draft.trim() && !image) return;
    setSending(true);
    setSendError("");
    setNeedsKeypair(false);

    // Local flag, not just the needsKeypair state var — the catch block
    // below runs synchronously off this function's own execution, and
    // relying on the just-set React state here would read a stale
    // closed-over value if React hasn't committed the update yet.
    let missingKeypair = false;

    try {
      const body = new FormData();
      if (draft.trim()) {
        const sharedKey = await getConversationKey(requestId);
        if (!sharedKey) {
          missingKeypair = true;
          setNeedsKeypair(true);
          throw new Error(
            "Your device isn't set up for encrypted messaging yet (or the other side isn't)."
          );
        }
        body.append("content", await encryptMessageContent(sharedKey, draft));
        body.append("encrypted", "true");
      }
      // Multipart only when an image is actually attached — a plain JSON
      // body still works for text-only sends (server accepts both).
      if (image) body.append("image", image);

      const res = await fetch(`/api/requests/${requestId}/messages`, { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't send that message.");
      }
      setDraft("");
      setImage(null);
      refetch();
    } catch (err) {
      setSendError(err.message);
      // Clear a rejected image rather than leave a broken/invalid
      // preview sitting on screen — most send failures with an image
      // attached are about that image (size/type); retrying means
      // deliberately re-attaching, not silently resending the same
      // bad file. Exception: a missing-keypair failure has nothing to
      // do with the image (Sibling review finding, second round) — the
      // image the user already selected/captioned shouldn't be silently
      // discarded for an unrelated reason, forcing them to re-attach it
      // after fixing their key via the recovery button above.
      if (image && !missingKeypair) setImage(null);
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <Card>
        <p>{error}</p>
        <Button onClick={onBack}>Back</Button>
      </Card>
    );
  }

  if (!request) {
    return <Card>Loading…</Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
      <Button variant="secondary" onClick={onBack}>← Back</Button>

      <Card className="review-summary">
        <h2>Request details</h2>
        <div className="review-row">
          <span className="review-label">Issue/Request</span>
          <span className="review-value" dir="auto">{request.freeText}</span>
        </div>
        <div className="review-row">
          <span className="review-label">Status</span>
          <span className="review-value">{labelize(request.status)}</span>
        </div>
        <div className="review-row">
          <span className="review-label">Urgency</span>
          <span className="review-value">{labelize(request.urgency)}</span>
        </div>
        {request.type && (
          <div className="review-row">
            <span className="review-label">Type</span>
            <span className="review-value">{labelize(request.type)}</span>
          </div>
        )}
        {request.additionalInfo && (
          <div className="review-row">
            <span className="review-label">Anything else</span>
            <span className="review-value" dir="auto">{request.additionalInfo}</span>
          </div>
        )}
        {typeDetailRows(request.typeDetails)}
      </Card>

      <Card>
        <h2>Messages</h2>
        {decrypting ? (
          <p className="review-empty">Loading messages…</p>
        ) : (
          <MessageThread messages={decryptedMessages} />
        )}
        {needsKeypair && (
          <p role="alert">
            <button type="button" onClick={handleGenerateKeypair} disabled={keypairStatus === "working"}>
              {keypairStatus === "working" ? "Generating…" : "Generate my encryption key"}
            </button>
            {keypairStatus === "error" && " Failed — try again."}
          </p>
        )}
        {image && (
          <div className="message-image-preview">
            <img src={imagePreviewUrl} alt="Selected attachment preview" />
            <button type="button" onClick={() => setImage(null)} aria-label="Remove image">✕</button>
          </div>
        )}
        {sendError && <p className="message-send-error" role="alert">{sendError}</p>}
        <div className="message-compose">
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="message-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setImage(file);
              e.target.value = ""; // allow re-picking the same file later
            }}
          />
          <textarea
            className="field-input message-textarea"
            dir="auto"
            rows={1}
            aria-label="Message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            placeholder="Message…"
          />
          {/* One button slot: camera (opens the file picker) when the box
              is empty and no image is attached, send-arrow once there's
              text or an image. Picking an image keeps the box open for an
              optional caption before sending, not an immediate send — one
              Message row holds content + imageUrl together (G411-24). */}
          {draft.trim() || image ? (
            <button
              type="button"
              className="message-send-btn"
              onClick={sendMessage}
              disabled={sending}
              aria-label="Send"
            >
              →
            </button>
          ) : (
            <button
              type="button"
              className="message-send-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
            >
              📷
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

export default RequestDetail;
