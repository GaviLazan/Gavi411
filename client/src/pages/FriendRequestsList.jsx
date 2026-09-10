import Card from "../components/Card";
import Button from "../components/Button";
import { CLOSED_STATUSES, RequestCard } from "./RequestList";
import { useRequests } from "../lib/useRequests";

// Friend's open/closed requests list (G411-95 — extracted from
// RequestList's toggle; open and closed were originally two near-
// identical components, merged into one parameterized by `status` since
// only the filter predicate and empty-state text differed). Reuses
// RequestCard and CLOSED_STATUSES from RequestList to keep filtering
// logic in one place.
function FriendRequestsList({ status, onOpenRequest }) {
  const { requests, error, retry } = useRequests();

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

  // Pre-G411-95 fallback, restored: a friend whose only requests are all
  // closed sees their most recent one here instead of a bare empty state
  // (Open requests screen only — Closed requests has nothing to fall back
  // to). `requests` comes from the API sorted createdAt desc, so [0] of
  // the closed set is already the most recent.
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
