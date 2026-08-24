import { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";

// Statuses that read as "done" for the open/closed toggle (G411-67).
// PRD/brain.md's lifecycle only names a single terminal "closed" state
// explicitly, but describes CANCELLED/SELF_SOLVED as separate exit
// paths off the same chain — all three are "not still active," so they
// group together as "closed" here for the toggle. Flagged for Gavi to
// confirm; easy to narrow to CLOSED-only later if that's not the intent.
const CLOSED_STATUSES = ["CLOSED", "CANCELLED", "SELF_SOLVED"];

function statusLabel(status) {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function RequestCard({ request }) {
  return (
    <Card style={{ width: "100%", textAlign: "start" }}>
      <p dir="auto" style={{ fontWeight: 600 }}>
        {request.freeText}
      </p>
      <p style={{ color: "var(--text)", fontSize: 14 }}>
        {statusLabel(request.status)}
        {request.type ? ` · ${statusLabel(request.type)}` : ""}
      </p>
    </Card>
  );
}

// Request list / home screen (G411-67). Shows the signed-in friend's own
// open requests (or everyone's, if admin — decided server-side, this
// component just renders whatever GET /api/requests returns), a toggle
// to reveal closed ones, and a fallback to the most recent closed
// request when there are no open ones at all.
function RequestList({ onNewRequest, onShowInstallHelp }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Cookie-based Clerk session, same as NewRequest.jsx's fetches —
        // no manual Authorization header needed.
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
  }, []);

  if (error) {
    return (
      <Card>
        <p>{error}</p>
        <Button onClick={onNewRequest}>New request</Button>
      </Card>
    );
  }

  if (requests === null) {
    return <Card>Loading…</Card>;
  }

  const openRequests = requests.filter((r) => !CLOSED_STATUSES.includes(r.status));
  const closedRequests = requests.filter((r) => CLOSED_STATUSES.includes(r.status));
  const allClosed = requests.length > 0 && openRequests.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%" }}>
      <Button variant="primary" onClick={onNewRequest}>
        + New request
      </Button>

      {openRequests.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <h2>Open requests</h2>
          {openRequests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}

      {allClosed && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <h2>Most recent request</h2>
          <RequestCard request={closedRequests[0]} />
        </div>
      )}

      {!allClosed && requests.length === 0 && <p>No requests yet — start one above.</p>}

      {closedRequests.length > 0 && !allClosed && (
        <>
          <Button variant="secondary" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? "Hide closed requests" : "Show closed requests"}
          </Button>
          {showClosed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {closedRequests.map((r) => (
                <RequestCard key={r.id} request={r} />
              ))}
            </div>
          )}
        </>
      )}

      <p style={{ fontSize: 13 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onShowInstallHelp(); }}>
          Installing on iPhone
        </a>
      </p>
    </div>
  );
}

export default RequestList;
