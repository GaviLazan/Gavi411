import { useUser } from "@clerk/react";
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

  if (messages.length === 0) {
    return <p className="review-empty">No messages yet.</p>;
  }

  return (
    <div className="message-thread">
      {messages.map((m) => {
        const isOwn = m.userId === user?.id;
        return (
          <div className={`message-row ${isOwn ? "message-own" : "message-other"}`} key={m.id}>
            <div className="message-bubble" dir="auto">
              {m.content}
              {m.imageUrl && <img className="message-image" src={m.imageUrl} alt="Attached image" />}
            </div>
            <span className="message-time">
              {new Date(m.createdAt).toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default MessageThread;
