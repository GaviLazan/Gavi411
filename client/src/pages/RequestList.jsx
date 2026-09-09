import Card from "../components/Card";

// Statuses that read as "done" for the open/closed toggle (G411-67).
// PRD/brain.md's lifecycle only names a single terminal "closed" state
// explicitly, but describes CANCELLED/SELF_SOLVED as separate exit
// paths off the same chain — all three are "not still active," so they
// group together as "closed" here for the toggle. Flagged for Gavi to
// confirm; easy to narrow to CLOSED-only later if that's not the intent.
// Exported — adminListSort.js (G411-37) reuses this same "what counts as
// closed" rule for the admin list's open/closed filter, instead of
// carrying its own separate copy (Sibling review finding).
export const CLOSED_STATUSES = ["CLOSED", "CANCELLED", "SELF_SOLVED"];

// Exported — RequestDetail.jsx/AdminList.jsx reuse this for the same
// enum-label formatting instead of duplicating it (Sibling review finding).
export function statusLabel(status) {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// G411-75: clicking a card opens its detail page. A real <button>
// wrapping the Card (not a div onClick) so it's keyboard/AT-accessible
// for free — same "reset UA chrome, keep the visual" pattern App.jsx's
// wordmark-button already uses. Card itself stays a plain div (no new
// "as" prop) since this is the only caller that needs it clickable.
// Exported (G411-95) — OpenRequestsList/ClosedRequestsList reuse this
// to avoid duplicating the card rendering logic.
export function RequestCard({ request, onClick }) {
  return (
    <button type="button" className="request-card-button" onClick={onClick}>
      <Card style={{ width: "100%", textAlign: "start" }}>
        <p dir="auto" style={{ fontWeight: 600 }}>
          {request.freeText}
        </p>
        <p style={{ color: "var(--text)", fontSize: 14 }}>
          {statusLabel(request.status)}
          {request.type ? ` · ${statusLabel(request.type)}` : ""}
        </p>
      </Card>
    </button>
  );
}

// The RequestList component itself (friend home-screen open/closed
// toggle) is gone as of G411-95 — the friend home screen now renders
// only "+ New request" (App.jsx), and Open/Closed requests are reached
// via the hamburger menu's OpenRequestsList/ClosedRequestsList instead.
// This file stays only for the shared exports above (CLOSED_STATUSES,
// statusLabel, RequestCard), still used by AdminList.jsx, RequestDetail.jsx,
// adminListSort.js, OpenRequestsList.jsx, and ClosedRequestsList.jsx —
// same reasoning as this file's own G411-37 precedent of removing a
// component's body once unreachable while keeping its live exports.
