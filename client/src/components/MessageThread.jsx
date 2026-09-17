import { useUser } from "@clerk/react";
import { useRef, useEffect } from "react";
import "./MessageThread.css";

// Real thread UI (G411-25), replacing G411-24's throwaway review-row list.
// Alignment is per-viewer: a message is "own" if its userId matches the
// CURRENT signed-in viewer's clerkId — not by role — so a friend sees
// their own messages on the right and Gavi's on the left, and Gavi
// viewing the same thread as admin sees the mirror image. Matches the
// Design Inspo/chat-interface reference: own messages as bubbles, the
// other side as plain text.
function MessageThread({ messages }) {
  const { user } = useUser();
  // G411-78: aria-live region attached after mount to announce new
  // messages without re-announcing pre-existing history on load
  const containerRef = useRef(null);
  const armed = useRef(false);

  // G411-78: arm aria-live after initial mount, one tick after React
  // has rendered all initial content to the DOM. This ensures that
  // screen readers don't announce the initial batch of messages on first
  // load (the region is not live yet while those messages are inserted),
  // but DO announce new additions on subsequent refetches (from G411-92's
  // polling). The attribute is added via ref, not static JSX, to make the
  // timing explicit and deterministic across browsers.
  //
  // Runs on every render (no dependency array) rather than once — the
  // container only exists in the DOM once messages.length > 0 (see the
  // empty-state early return below), so a thread that STARTS empty and
  // then gets its first message needs this to re-check on that render,
  // not just on the component's original mount.
  useEffect(() => {
    if (containerRef.current && !armed.current) {
      containerRef.current.setAttribute("aria-live", "polite");
      containerRef.current.setAttribute("aria-relevant", "additions");
      armed.current = true;
    }
  });

  if (messages.length === 0) {
    return <p className="review-empty">No messages yet.</p>;
  }

  return (
    <div className="message-thread" ref={containerRef}>
      {messages.map((m) => {
        const isOwn = m.userId === user?.id;
        // G411-93: system messages (nudges) are rendered centered and
        // visually distinct from real chat messages
        if (m.isSystem) {
          return (
            <div className="message-row message-system" key={m.id}>
              <div className="message-system-content" dir="auto">
                {m.content}
              </div>
              <span className="message-time">
                {new Date(m.createdAt).toLocaleString("en-GB")}
              </span>
            </div>
          );
        }
        return (
          <div className={`message-row ${isOwn ? "message-own" : "message-other"}`} key={m.id}>
            <div className="message-bubble" dir="auto">
              {m.content}
              {m.imageUrl && <img className="message-image" src={m.imageUrl} alt="Attached image" />}
            </div>
            {/* en-GB pins dd/mm/yyyy explicitly (Gavi: dates should default
                to dd/mm/yyyy, not mm/dd/yyyy) — bare toLocaleString() used
                the browser's own locale, which reads mm/dd/yyyy on a
                US-configured browser regardless of who's actually using
                the app. */}
            <span className="message-time">
              {new Date(m.createdAt).toLocaleString("en-GB")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default MessageThread;
