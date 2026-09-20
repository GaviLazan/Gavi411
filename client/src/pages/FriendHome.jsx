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

  // Split into open/closed before rendering
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
      {/* Loading state */}
      {requests === null && (
        <p>Loading…</p>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="friend-home-request-card">
          <p>Nothing yet — tell Gavi what's up</p>
        </div>
      )}

      {/* Open requests list */}
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

      {/* Closed requests (collapsible) */}
      {requests !== null && !isEmpty && closed && closed.length > 0 && (
        <details className="friend-home-closed-details">
          <summary>Earlier · {closed.length}</summary>
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

      {/* Composer: a fixed overlay pinned to the bottom of the viewport.
          Its background carries the fade — a 100px gradient band ending
          fully opaque at the button's top edge, then solid page
          background from there down to the screen edge — so the list
          fades out into it and stays hidden below, rather than
          reappearing beside or under the button. */}
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
