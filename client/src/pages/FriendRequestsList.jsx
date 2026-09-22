import { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { CLOSED_STATUSES } from "../lib/requestStatus";
import { RequestCard } from "./RequestCard";

function FriendRequestsList({ status, onOpenRequest, refreshToken }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

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

  const filtered = requests
    ? requests.filter((r) => (status === "closed") === CLOSED_STATUSES.includes(r.status))
    : null;

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
        <Card>{error}</Card>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  }

  if (filtered === null) {
    return <p>Loading…</p>;
  }

  // A friend with only closed requests sees their most recent one here
  // instead of a bare empty state (Open screen only). `requests` is
  // API-sorted createdAt desc, so [0] of the closed set is most recent.
  if (filtered.length === 0 && status === "open" && requests.length > 0) {
    const mostRecentClosed = requests.find((r) => CLOSED_STATUSES.includes(r.status));
    if (mostRecentClosed) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 420 }}>
          <h2>Most recent request</h2>
          <RequestCard request={mostRecentClosed} onClick={() => onOpenRequest(mostRecentClosed.id)} />
        </div>
      );
    }
  }


  if (filtered.length === 0) {
    return (
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <p>No {status} requests yet.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 420 }}>
      {filtered.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          onClick={() => onOpenRequest(request.id)}
        />
      ))}
    </div>
  );
}

export default FriendRequestsList;
