import { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { CLOSED_STATUSES, statusLabel, RequestCard } from "./RequestList";

// Friend's closed requests list (G411-95 — extracted from RequestList's
// toggle). Reuses RequestCard and CLOSED_STATUSES from RequestList to
// keep filtering logic in one place.
function ClosedRequestsList({ onOpenRequest }) {
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
        if (!cancelled) setError("Couldn't load your requests. Try again?");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  const closedRequests = requests
    ? requests.filter((r) => CLOSED_STATUSES.includes(r.status))
    : null;

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
        <Card>{error}</Card>
        <Button onClick={() => setRetryToken((t) => t + 1)}>Try again</Button>
      </div>
    );
  }

  if (closedRequests === null) {
    return <p>Loading…</p>;
  }

  if (closedRequests.length === 0) {
    return (
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <p>No closed requests yet.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", maxWidth: 420 }}>
      {closedRequests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          onClick={() => onOpenRequest(request.id)}
        />
      ))}
    </div>
  );
}

export default ClosedRequestsList;
