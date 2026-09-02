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
import "./RequestDetail.css";
import { getConversationKey, encryptMessageContent, decryptMessageContent, OTHER_PARTY_MISSING_KEY } from "../lib/conversationCrypto";
import { createAndUploadKeypair } from "../lib/escrow";
import { requestDeviceLink, getMyDeviceStatus, wrapMissingConversationKeys } from "../lib/deviceLinking";
import { loadPrivateKey } from "../lib/keyStore";
import { E2E_ENABLED } from "../lib/e2eConfig";

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

// G411-38: admin's three tabs. Friends only ever see one view (below),
// no tab state needed for them.
const ADMIN_TABS = [
  { value: "details", label: "Details" },
  { value: "thread", label: "Thread" },
  { value: "notes", label: "Notes" },
];

function RequestDetail({ requestId, onBack, isAdmin }) {
  const [request, setRequest] = useState(null);
  // Admin-only tab state (G411-38) — friends never see tabs, so this is
  // simply unused/ignored on their path rather than gated behind isAdmin
  // at declaration (cheaper than conditionally calling useState).
  const [adminTab, setAdminTab] = useState("thread");
  // Details/Thread side-by-side toggle — defaults on for a wide viewport
  // (matches the codebase's one existing breakpoint, App.css/index.css),
  // off for narrow, but admin can flip it either way regardless of
  // width (Gavi: "doesn't need to be auto, I can toggle it"). Read once
  // at mount, not kept in sync with live resizes — a toggle the admin
  // just set shouldn't silently flip back because the window resized.
  const [sideBySide, setSideBySide] = useState(() => window.matchMedia("(min-width: 1025px)").matches);
  const [error, setError] = useState(""); // load failure — replaces the whole page
  const [sendError, setSendError] = useState(""); // send failure — inline, thread stays visible
  // True specifically when the send failed because THIS device has no
  // keypair (not any other send failure) — drives whether the recovery
  // button below renders. A dedicated flag rather than string-matching
  // sendError's text, which is fragile against future copy changes.
  const [needsKeypair, setNeedsKeypair] = useState(false);
  // Matan's Sibling review, PR #35, Fix 2: getConversationKey returning
  // null used to mean two unrelated things — THIS device has no key
  // (needsKeypair above, genuinely fixable by the recovery buttons below)
  // or the OTHER PARTY has no key yet (nothing on this device is broken).
  // Both used to show the same destructive "request access to your
  // existing messages" button, which calls requestDeviceLink() —
  // unconditionally overwrites this device's local keypair via
  // generateKeypair()+savePrivateKey(). Under the other-party-missing
  // cause, clicking it destroyed a perfectly good working key for no
  // benefit. This flag gates the buttons off in favor of a plain,
  // non-actionable status line for that case.
  const [otherPartyMissingKey, setOtherPartyMissingKey] = useState(false);
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
    // Decision #98 pause: sendMessage() below never sends encrypted:true
    // anymore, but rows from BEFORE the pause can still be real encrypted
    // envelopes (E2E was live, G411-82) — skipping key derivation
    // unconditionally would render those as "unable to decrypt" even
    // though the ciphertext and both parties' keys are still intact
    // (Sibling review finding, PR #38). Only skip the fetch/derive when
    // every row in this thread is already plaintext — same guard
    // searchIndex.js uses.
    const hasEncrypted = request.message.some((m) => m.encrypted);
    (E2E_ENABLED || hasEncrypted ? getConversationKey(requestId) : Promise.resolve(null))
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

  // G411-28 device-linking, bare-minimum trigger (real cockpit-side UI is
  // G411-37/38's job). Distinct from handleGenerateKeypair above: that one
  // makes THIS device the account's only key (fine for a genuinely
  // keyless account — G411-83's bootstrap case), this one asks admin to
  // grant THIS device access to whatever key(s) already exist for the
  // account elsewhere — the two are alternatives, not sequential steps,
  // so both stay offered side by side rather than one replacing the other.
  const [deviceLinkStatus, setDeviceLinkStatus] = useState("idle"); // 'idle' | 'requesting' | 'pending' | 'error'

  useEffect(() => {
    if (!E2E_ENABLED) return;
    getMyDeviceStatus().then((device) => {
      if (device?.status === "PENDING") setDeviceLinkStatus("pending");
    });
  }, []);

  // Matan's Sibling review, PR #35, Fix 1a: self-healing sweep, scoped to
  // just this Request — a second, more contained trigger point alongside
  // App.jsx's on-load sweep, so a long admin session (tab left open for
  // days, no reload) still eventually self-heals for whichever
  // conversations admin actually opens. Best-effort, same silent-no-op
  // convention as the on-load sweep.
  useEffect(() => {
    if (!E2E_ENABLED || !isAdmin) return;
    loadPrivateKey().then((key) => {
      if (key) wrapMissingConversationKeys(key, requestId);
    });
  }, [isAdmin, requestId]);

  async function handleRequestDeviceLink() {
    setDeviceLinkStatus("requesting");
    try {
      await requestDeviceLink();
      setDeviceLinkStatus("pending");
    } catch {
      setDeviceLinkStatus("error");
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
    setOtherPartyMissingKey(false);

    // Local flag, not just the needsKeypair state var — the catch block
    // below runs synchronously off this function's own execution, and
    // relying on the just-set React state here would read a stale
    // closed-over value if React hasn't committed the update yet.
    let missingKeypair = false;

    try {
      const body = new FormData();
      if (draft.trim()) {
        // Decision #98 pause: always send plaintext, no key derivation,
        // no blocking on either side's keypair status. E2E_ENABLED flips
        // this back to the real encrypt path.
        if (E2E_ENABLED) {
          const sharedKey = await getConversationKey(requestId);
          if (sharedKey === OTHER_PARTY_MISSING_KEY) {
            missingKeypair = true; // still blocks the send + keeps the image, just not THIS device's fault
            setOtherPartyMissingKey(true);
            throw new Error("Waiting on the other side to set up encryption — nothing to fix on your device.");
          }
          if (!sharedKey) {
            missingKeypair = true;
            setNeedsKeypair(true);
            throw new Error(
              "Your device isn't set up for encrypted messaging yet (or the other side isn't)."
            );
          }
          body.append("content", await encryptMessageContent(sharedKey, draft));
          body.append("encrypted", "true");
        } else {
          body.append("content", draft);
        }
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

  const detailsCard = (
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
  );

  const threadCard = (
    <Card>
      <h2>Messages</h2>
      {decrypting ? (
          <p className="review-empty">Loading messages…</p>
        ) : (
          <MessageThread messages={decryptedMessages} />
        )}
        {E2E_ENABLED && otherPartyMissingKey && (
          // Matan's Sibling review, PR #35, Fix 2 — nothing to fix on this
          // device, so no button is offered (the destructive "request
          // access" flow below would overwrite a perfectly good local key
          // for no benefit).
          <p role="alert">Waiting on the other side to set up encryption.</p>
        )}
        {E2E_ENABLED && needsKeypair && (
          <p role="alert">
            <button type="button" onClick={handleGenerateKeypair} disabled={keypairStatus === "working"}>
              {keypairStatus === "working" ? "Generating…" : "Generate my encryption key"}
            </button>
            {keypairStatus === "error" && " Failed — try again."}
            {/* Matan's Sibling review, PR #35, Medium finding: admin's own
                second device has no Request rows of its own to inherit
                (admin never owns a Request — device.userId never matches
                one), so this self-service flow silently gets zero keys
                for admin. Real admin-key recovery is G411-83's job, a
                different mechanism — hide this flow for admin entirely
                rather than let it look like it should work. */}
            {!isAdmin && (
              <>
                {" or, if you already have an account with messages elsewhere, "}
                {deviceLinkStatus === "pending" ? (
                  "a request to link this device is waiting on admin approval."
                ) : (
                  <button type="button" onClick={handleRequestDeviceLink} disabled={deviceLinkStatus === "requesting"}>
                    {deviceLinkStatus === "requesting" ? "Requesting…" : "request access to your existing messages"}
                  </button>
                )}
                {deviceLinkStatus === "error" && " Failed — try again."}
              </>
            )}
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
  );

  // Storage/logic is G411-40's job — this tab is just the shell slot it
  // plugs into.
  const notesCard = (
    <Card>
      <h2>Notes</h2>
      <p className="review-empty">Private notes aren't wired up yet.</p>
    </Card>
  );

  if (!isAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        {detailsCard}
        {threadCard}
      </div>
    );
  }

  // Admin: tabbed shell (G411-38) — status pill pinned near the top,
  // outside/above the tabs, so it stays visible across every tab switch.
  // The pill is read-only display for now; real lifecycle controls
  // (dropdown/actions to change status) are G411-39's job, not this
  // ticket's — this is only the shell that will host them.
  //
  // sideBySide (toggle above) puts Details/Thread in two columns and
  // hides their now-redundant tab buttons — nothing to switch between
  // once both are visible. Notes stays its own tab either way.
  return (
    <div className="admin-detail-shell" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: sideBySide ? 900 : 420 }}>
      <Button variant="secondary" onClick={onBack}>← Back</Button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span className="status-pill">{labelize(request.status)}</span>
        <button type="button" className="admin-layout-toggle" onClick={() => setSideBySide((v) => !v)}>
          {sideBySide ? "Stack tabs" : "Side by side"}
        </button>
      </div>

      {/* Side by side already shows Details+Thread together — nothing
          left to switch between there, so those two buttons hide.
          Notes becomes a single on/off toggle instead of a one-way tab
          (a plain filtered tab button left no way back to the columns —
          caught live: "can't get back to details and thread"). */}
      {sideBySide ? (
        <div role="tablist" style={{ display: "flex", gap: "var(--space-2)", borderBottom: "1px solid var(--border)" }}>
          <button
            type="button"
            role="tab"
            aria-selected={adminTab === "notes"}
            className={`admin-tab${adminTab === "notes" ? " admin-tab-active" : ""}`}
            onClick={() => setAdminTab(adminTab === "notes" ? "details" : "notes")}
          >
            {adminTab === "notes" ? "← Details & Thread" : "Notes"}
          </button>
        </div>
      ) : (
        <div role="tablist" style={{ display: "flex", gap: "var(--space-2)", borderBottom: "1px solid var(--border)" }}>
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={adminTab === tab.value}
              className={`admin-tab${adminTab === tab.value ? " admin-tab-active" : ""}`}
              onClick={() => setAdminTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {sideBySide ? (
        adminTab === "notes" ? notesCard : (
          <div className="admin-detail-columns">
            {detailsCard}
            {threadCard}
          </div>
        )
      ) : (
        <>
          {adminTab === "thread" && threadCard}
          {adminTab === "details" && detailsCard}
          {adminTab === "notes" && notesCard}
        </>
      )}
    </div>
  );
}

export default RequestDetail;
