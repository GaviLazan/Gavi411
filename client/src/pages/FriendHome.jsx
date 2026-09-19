import { useEffect, useState } from "react";
import { CLOSED_STATUSES, lastActivityAt, timeSince } from "../lib/adminListSort";
import { RequestCard } from "./RequestCard";
import "./FriendHome.css";

export default function FriendHome({ refreshToken, onOpenRequest, onCompose }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [presence, setPresence] = useState(null);

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

  // Fetch presence (public, no auth required)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/presence");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPresence(data);
        }
      } catch {
        // Silently fail — presence is informational only
      }
    }
    load();
  }, []);

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
      {/* Presence header */}
      {presence && (
        <div className="friend-home-header">
          {presence.admin?.profilePic ? (
            <img src={presence.admin.profilePic} alt="Gavi" className="friend-home-avatar" />
          ) : (
            <div className="friend-home-avatar-placeholder" />
          )}
          <div className="friend-home-header-text">
            <p className="friend-home-name">Gavi</p>
            <p className="friend-home-presence">
              {presence.isOnline ? "online" : "offline — replies may wait"}
            </p>
          </div>
          <div className={`friend-home-presence-dot ${presence.isOnline ? "online" : "offline"}`} />
        </div>
      )}

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
      {requests !== null && !isEmpty && sortedOpen && (
        <div className="friend-home-open-list">
          {sortedOpen.map((req) => {
            const lastMsg = req.message && req.message.length > 0 ? req.message[0] : null;
            const sender = lastMsg && lastMsg.userId === req.userId ? "You" : "Gavi";
            const preview = lastMsg ? lastMsg.content : null;
            const meta = timeSince(lastActivityAt(req));

            return (
              <div
                key={req.id}
                onClick={() => onOpenRequest(req.id)}
                className="friend-home-request-card-wrapper"
              >
                <RequestCard
                  request={req}
                  onClick={() => onOpenRequest(req.id)}
                  showStatusChip
                  showLastMessage={!!preview}
                  showMeta
                  lastMessageSender={sender}
                  lastMessagePreview={preview}
                  meta={meta}
                />
              </div>
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

      {/* Composer bar at bottom */}
      <button
        type="button"
        className="friend-home-composer-bar"
        onClick={onCompose}
      >
        <span>What's up?</span>
        <span className="friend-home-send-icon">→</span>
      </button>
    </div>
  );
}
