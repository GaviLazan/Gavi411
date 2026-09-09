import Card from "../components/Card";
import Button from "../components/Button";
import { CLOSED_STATUSES, statusLabel, RequestCard } from "./RequestList";
import { useRequests } from "../lib/useRequests";

// Friend's closed requests list (G411-95 — extracted from RequestList's
// toggle). Reuses RequestCard and CLOSED_STATUSES from RequestList to
// keep filtering logic in one place.
function ClosedRequestsList({ onOpenRequest }) {
  const { requests, error, retry } = useRequests();

  const closedRequests = requests
    ? requests.filter((r) => CLOSED_STATUSES.includes(r.status))
    : null;

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
        <Card>{error}</Card>
        <Button onClick={retry}>Try again</Button>
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
