import { useEffect, useState } from "react";
import { CLOSED_STATUSES, lastActivityAt, timeSince } from "../lib/adminListSort";
import { RequestCard } from "./RequestCard";
import "./FriendHome.css";

export default function FriendHome({ refreshToken, onOpenRequest, onCompose }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  // Fetch requests
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      try {
        const res = await fetch("/api/requests");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (!cancelled) setRequests(data);
      } catch {
        if (!cancelled) setError("Couldn't load requests. Try again?");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [retryToken, refreshToken]);

  const retry = () => setRetryToken((t) => t + 1);

  if (error) {
    return (
      <div className="friend-home-error">
        <p>{error}</p>
        <button type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  const open = requests
    ? requests.filter((r) => !CLOSED_STATUSES.includes(r.status))
    : null;
  const closed = requests
    ? requests.filter((r) => CLOSED_STATUSES.includes(r.status))
    : null;

  // Sort open by last activity descending
  const sortedOpen = open ? [...open].sort((a, b) => new Date(lastActivityAt(b)) - new Date(lastActivityAt(a))) : null;

  const isEmpty = requests && open.length === 0 && closed.length === 0;

  return (
    <div className="friend-home">
      {requests === null && (
        <p style={{ minHeight: 200 }}>Loading…</p>
      )}

      {isEmpty && (
        <div className="friend-home-request-card">
          <p>Nothing yet — ask Gavi for help</p>
        </div>
      )}

      {requests !== null && !isEmpty && sortedOpen && sortedOpen.length > 0 && (
        <div className="friend-home-open-list">
          {sortedOpen.map((req) => {
            const lastMsg = req.message && req.message.length > 0 ? req.message[0] : null;
            const sender = lastMsg && lastMsg.userId === req.userId ? "You" : "Gavi";
            const preview = lastMsg ? lastMsg.content : null;
            const meta = timeSince(lastActivityAt(req));

            return (
              <RequestCard
                key={req.id}
                request={req}
                onClick={() => onOpenRequest(req.id)}
                showStatusChip
                showLastMessage={!!preview}
                showMeta
                lastMessageSender={sender}
                lastMessagePreview={preview}
                meta={meta}
              />
            );
          })}
        </div>
      )}

      {requests !== null && !isEmpty && closed && closed.length > 0 && (
        <details className="friend-home-closed-details">
          <summary>Previous requests · {closed.length}</summary>
          <div className="friend-home-closed-list">
            {closed.map((req) => (
              <div key={req.id} className="friend-home-request-card-wrapper">
                <RequestCard
                  request={req}
                  onClick={() => onOpenRequest(req.id)}
                  showStatusChip
                />
              </div>
            ))}
          </div>
        </details>
      )}

      {requests !== null && (
        <div className="friend-home-composer-fixed">
          <button
            type="button"
            className="friend-home-composer-bar"
            onClick={onCompose}
          >
            <span>What's up?</span>
            <span className="friend-home-send-icon">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
