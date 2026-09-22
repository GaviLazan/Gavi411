import { useUser } from "@clerk/react";
import { useRef, useEffect } from "react";
import { formatTime, formatDayLabel } from "../lib/format";
import "./MessageThread.css";

// Message thread UI: alignment is per-viewer (own messages on right, others on left).
function MessageThread({ messages }) {
  const { user } = useUser();
  const containerRef = useRef(null);
  const armed = useRef(false);

  // Arm aria-live after render: screen readers announce new messages but not initial history.
  // Runs on every render so empty→filled threads update correctly.
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
      {messages.map((m, i) => {
        const isOwn = m.userId === user?.id;
        const prevMessage = messages[i - 1];
        const showDayDivider = !prevMessage || new Date(prevMessage.createdAt).toDateString() !== new Date(m.createdAt).toDateString();

        return (
          <div key={m.id}>
            {showDayDivider && (
              <div className="message-day-divider">
                {formatDayLabel(m.createdAt)}
              </div>
            )}
            {m.isSystem ? (
              <div className="message-row message-system">
                <div className="message-system-content" dir="auto">
                  {m.content}
                </div>
                <span className="message-time">
                  {formatTime(m.createdAt)}
                </span>
              </div>
            ) : (
              <div className={`message-row ${isOwn ? "message-own" : "message-other"}`}>
                <div className="message-bubble" dir="auto">
                  {m.content}
                  {m.imageUrl && <img className="message-image" src={m.imageUrl} alt="Attached image" />}
                </div>
                <span className="message-time">
                  {formatTime(m.createdAt)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MessageThread;
