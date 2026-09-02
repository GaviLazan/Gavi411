import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Input from "../components/Input";
import { buildSearchIndex, searchIndex } from "../lib/searchIndex";
import { loadLinkedConversationKeys } from "../lib/deviceLinking";
import { seedLinkedConversationKeys } from "../lib/conversationCrypto";
// Sibling review finding, PR #36: the new "No matching conversations."
// empty state below uses .review-empty, which only ever worked here by
// relying on another page (NewRequest.jsx/RequestDetail.jsx) importing
// this CSS first — same implicit-CSS-import bug class this codebase has
// hit twice before on RequestDetail.jsx itself. Imported directly so this
// page's styling doesn't depend on another page having loaded first.
import "../components/ReviewSummary.css";

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

// Exported — RequestDetail.jsx reuses this for the same enum-label
// formatting instead of duplicating it (Sibling review finding).
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
function RequestCard({ request, onClick }) {
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

// Request list / home screen (G411-67). Shows the signed-in friend's own
// open requests (or everyone's, if admin — decided server-side, this
// component just renders whatever GET /api/requests returns), a toggle
// to reveal closed ones, and a fallback to the most recent closed
// request when there are no open ones at all.
function RequestList({ onNewRequest, onShowInstallHelp, onOpenRequest, isAdmin }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  // G411-75: starts collapsed, no persistence across visits (ticket
  // left this as a pickup-time call — always-collapsed is the simplest
  // reading of "starts collapsed by default" and needs no storage).
  const [openExpanded, setOpenExpanded] = useState(false);

  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      try {
        // Cookie-based Clerk session, same as NewRequest.jsx's fetches —
        // no manual Authorization header needed. Admin opts into
        // ?include=messages (G411-28 search index) — a regular friend
        // never needs every message body just to see their own request
        // list, so this stays off unless isAdmin actually asks for it.
        const url = isAdmin ? "/api/requests?include=messages" : "/api/requests";
        const res = await fetch(url);
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
  }, [retryToken, isAdmin]);

  // G411-28 admin search index: server only ever sees ciphertext, so
  // search has to run client-side, in admin's own browser, after
  // decrypting every conversation locally with keys admin already holds
  // (Gavi is a party to every request). Built once per successful load
  // ("decrypt all on admin app load" — Gavi's call, an admin session's
  // message volume is small enough that instant in-memory search after
  // one upfront decrypt beats decrypting piecemeal per keystroke).
  const [searchEntries, setSearchEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Sibling review finding (PR #36): a linked device's
  // linkedConversationKeys map (conversationCrypto.js) is otherwise only
  // ever seeded once, at App.jsx's sign-in effect — a request created (or
  // a wrap completed by admin's own missing-wraps sweep) after that
  // snapshot has no entry, so getConversationKey returns null and that
  // conversation's messages silently vanish from search with no
  // indicator. No push/poll infra exists to notify a linked device the
  // moment a new wrap lands (that's G411-84, explicitly deferred) — this
  // is the narrow, in-scope fix: re-poll on every RequestList mount, so
  // search reflects reasonably fresh state without needing new
  // infrastructure. A no-op (empty Map) for a device that was never
  // linked, same as App.jsx's own sign-in call.
  useEffect(() => {
    if (!isAdmin) return;
    loadLinkedConversationKeys().then(seedLinkedConversationKeys).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    // Sibling review finding (PR #36): isAdmin resolves asynchronously
    // (App.jsx's /api/me fetch) after the very first render, so this
    // effect and the fetch effect above can both re-fire once it flips
    // true — but this effect must not build against a `requests` value
    // fetched BEFORE isAdmin was true (i.e. without ?include=messages,
    // so every row lacks `.message`). Checking that at least one row
    // actually carries a `message` array (not just `isAdmin && requests`)
    // means this effect waits for the corrected re-fetch to land instead
    // of building a false "index" of zero entries from stale data.
    const hasMessageData = requests?.some((r) => Array.isArray(r.message));
    if (!isAdmin || !hasMessageData) {
      setSearchEntries([]);
      return;
    }
    buildSearchIndex(requests)
      .then((entries) => {
        if (!cancelled) setSearchEntries(entries);
      })
      // Sibling review finding: buildSearchIndex can still reject outright
      // (e.g. a bug outside its own per-request try/catch) — without this,
      // that was an unhandled promise rejection silently leaving
      // searchEntries stale with no indication anything went wrong.
      .catch(() => {
        if (!cancelled) setSearchEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, requests]);

  // Set (not array) — a request can have several matching messages, but
  // should only ever show up once in the filtered list.
  const matchingRequestIds = useMemo(() => {
    if (!searchQuery.trim()) return null; // null = "no search active", not "matched nothing"
    return new Set(searchIndex(searchEntries, searchQuery).map((e) => e.requestId));
  }, [searchEntries, searchQuery]);

  // "+ New request" doesn't depend on the list loading successfully —
  // creating a request has nothing to do with whether the existing list
  // could be fetched (Gavi's live catch, 2026-08-30: a transient list-load
  // failure used to block the New request button entirely, which made no
  // sense — the two are unrelated). Error/loading states now only replace
  // the list section below, not the whole screen.
  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
        <Button variant="primary" onClick={onNewRequest}>
          + New request
        </Button>
        <Card>
          <p>{error}</p>
          <Button onClick={() => setRetryToken((t) => t + 1)}>Try again</Button>
        </Card>
      </div>
    );
  }

  if (requests === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
        <Button variant="primary" onClick={onNewRequest}>
          + New request
        </Button>
        <Card>Loading…</Card>
      </div>
    );
  }

  const openRequests = requests.filter((r) => !CLOSED_STATUSES.includes(r.status));
  const closedRequests = requests.filter((r) => CLOSED_STATUSES.includes(r.status));
  const allClosed = requests.length > 0 && openRequests.length === 0;

  // A search in progress bypasses the whole open/closed/collapsible
  // machinery below — search means "show me every match, open or
  // closed," not "respect whatever toggle state those sections happen to
  // be in." Simpler and more correct than threading a filter through
  // every branch of that logic.
  const searchResults = matchingRequestIds && requests.filter((r) => matchingRequestIds.has(r.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
      <Button variant="primary" onClick={onNewRequest}>
        + New request
      </Button>

      {isAdmin && (
        <Input
          type="search"
          placeholder="Search conversations…"
          aria-label="Search conversations"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      )}

      {searchResults ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {searchResults.length === 0 ? (
            <p className="review-empty">No matching conversations.</p>
          ) : (
            searchResults.map((r) => <RequestCard key={r.id} request={r} onClick={() => onOpenRequest(r.id)} />)
          )}
        </div>
      ) : (
        <>
          {openRequests.length > 0 && (
            <div>
              <button
                type="button"
                className="collapsible-header"
                aria-expanded={openExpanded}
                aria-controls="open-requests-body"
                onClick={() => setOpenExpanded((v) => !v)}
              >
                <h2>Open requests</h2>
                <span className={`collapsible-arrow${openExpanded ? " expanded" : ""}`}>▾</span>
              </button>
              {/* inert (native, no JS focus-trap needed) pulls the collapsed
                  cards out of both tab order and the AT tree — Sibling review
                  finding: max-height:0/overflow:hidden alone still leaves
                  them focusable and screen-reader-visible. */}
              <div
                id="open-requests-body"
                className={`collapsible-body${openExpanded ? " expanded" : ""}`}
                inert={openExpanded ? undefined : true}
              >
                <div className="collapsible-body-inner">
                  {openRequests.map((r) => (
                    <RequestCard key={r.id} request={r} onClick={() => onOpenRequest(r.id)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {allClosed && !showClosed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <h2>Most recent request</h2>
              <RequestCard request={closedRequests[0]} onClick={() => onOpenRequest(closedRequests[0].id)} />
            </div>
          )}

          {requests.length === 0 && <p>No requests yet — start one above.</p>}

          {closedRequests.length > 0 && (
            <>
              <Button variant="secondary" onClick={() => setShowClosed((v) => !v)}>
                {showClosed ? "Hide closed requests" : "Show closed requests"}
              </Button>
              {showClosed && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {closedRequests.map((r) => (
                    <RequestCard key={r.id} request={r} onClick={() => onOpenRequest(r.id)} />
                  ))}
                </div>
              )}
            </>
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
