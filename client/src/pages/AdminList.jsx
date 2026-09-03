import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Select from "../components/Select";
import Input from "../components/Input";
import Button from "../components/Button";
import { statusLabel } from "./RequestList";
import { timeSince, lastActivityAt, filterRequests, sortRequests, groupByPerson, matchesPlainFields } from "../lib/adminListSort";
import { buildSearchIndex, searchIndex } from "../lib/searchIndex";
import { loadLinkedConversationKeys } from "../lib/deviceLinking";
import { seedLinkedConversationKeys } from "../lib/conversationCrypto";

// Admin request-list screen (G411-37). Distinct from the friend-facing
// RequestList — decision #46 (gavi411-brain.md) specs this as its own
// screen: a persistent sort/filter/group dropdown row at top (not tucked
// behind a toggle), flat rows sorted by urgency oldest-first by default,
// each showing avatar + friend's name + request type + short preview +
// urgency + time since last activity.
//
// Reuses GET /api/requests (same route RequestList already calls) — the
// admin branch of that route now includes a narrow `user` select
// (firstName/lastName/profilePic) so this screen has what it needs
// without a new endpoint (G411-37 backend fix).
//
// Search (G411-28) lives directly on this screen, not behind a separate
// "Search" button/view — Gavi's direct feedback after first review: he
// expects to search the list he's already looking at, not get bounced to
// a different page. Fetches ?include=messages (full ordered bodies, same
// as RequestList's admin search always did) and builds the same
// client-side decrypted index RequestList used to build — a search in
// progress filters `sorted`/`groups` in place instead of swapping views.
//
// Sort/filter/timeSince logic itself lives in lib/adminListSort.js (real
// test coverage there — this codebase's convention is lib/ gets tested,
// page components don't).

const SORT_OPTIONS = [
  { value: "urgency", label: "Urgency (oldest first)" },
  { value: "age", label: "Age (newest first)" },
];

const FILTER_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

const GROUP_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "person", label: "By person" },
];

// Small WhatsApp-style avatar — photo if present, initials fallback
// otherwise (decision #46). No new component: this is the only caller
// today, and it's simple enough that a dedicated Avatar.jsx would be
// speculative until a second caller actually needs it.
function Avatar({ user }) {
  const initials = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "?";
  const style = {
    width: 32,
    height: 32,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    background: "var(--border)",
    overflow: "hidden",
  };
  if (user?.profilePic) {
    return <img src={user.profilePic} alt="" style={{ ...style, objectFit: "cover" }} />;
  }
  return <div style={style}>{initials}</div>;
}

function AdminRequestRow({ request, onClick }) {
  const user = request.user;
  const friendName = user ? `${user.firstName} ${user.lastName}` : "Unknown";
  return (
    <button type="button" className="request-card-button" onClick={onClick}>
      <Card style={{ width: "100%", textAlign: "start", display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <Avatar user={user} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* dir="auto" (Sibling review finding): firstName/lastName are
              freeform Clerk profile fields, same category as freeText
              below — can contain Hebrew, need correct bidi rendering. */}
          <p dir="auto" style={{ fontWeight: 600 }}>
            {friendName}
            {request.type ? ` · ${statusLabel(request.type)}` : ""}
          </p>
          <p dir="auto" style={{ color: "var(--text)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {request.freeText}
          </p>
        </div>
        <div style={{ textAlign: "end", flexShrink: 0, fontSize: 13 }}>
          {/* Status wasn't shown anywhere in this row — the only way to
              tell was indirectly, via which side of the Open/Closed
              filter a request landed on (Gavi, live testing). */}
          <p style={{ fontWeight: 600 }}>{statusLabel(request.status)}</p>
          <p style={{ color: "var(--text)" }}>{statusLabel(request.urgency)}</p>
          <p style={{ color: "var(--text)" }}>{timeSince(lastActivityAt(request))}</p>
        </div>
      </Card>
    </button>
  );
}

function AdminList({ onOpenRequest, onNewRequest }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("urgency");
  const [filter, setFilter] = useState("open");
  const [group, setGroup] = useState("none");
  const [retryToken, setRetryToken] = useState(0);

  // Plain GET /api/requests by default — the lightweight admin path
  // (narrow `user` select + one-row-per-request `message` for "time
  // since last activity", not full bodies). Sibling review finding: an
  // earlier version of this fix always fetched ?include=messages (for
  // search), which silently defeated the point of that lightweight path
  // — every list load paid for every message body whether or not the
  // admin ever searched. Full messages are now fetched lazily, only once
  // the admin actually starts typing a search query (see the search
  // effect below), so the default list load stays on the cheap path.
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
  }, [retryToken]);

  const [searchEntries, setSearchEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRequests, setSearchRequests] = useState(null);

  // Lazy: only fetches full message bodies, seeds this device's linked
  // keys, and builds the decrypted search index once the admin actually
  // types something — a plain list view never pays this cost. Same
  // "decrypt all up front, once" shape RequestList's admin search used,
  // just deferred until it's actually needed.
  useEffect(() => {
    let cancelled = false;
    if (!searchQuery.trim()) {
      setSearchEntries([]);
      return;
    }
    if (searchRequests) return; // already fetched for this session

    async function loadForSearch() {
      try {
        await loadLinkedConversationKeys().then(seedLinkedConversationKeys).catch(() => {});
        const res = await fetch("/api/requests?include=messages");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (cancelled) return;
        setSearchRequests(data);
        const entries = await buildSearchIndex(data);
        if (!cancelled) setSearchEntries(entries);
      } catch {
        if (!cancelled) setSearchEntries([]);
      }
    }
    loadForSearch();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, searchRequests]);

  // Message-content matches (decrypted, via searchIndex) UNIONED with
  // plaintext-field matches (name/title/type — no decryption needed, all
  // already in memory). Gavi's direct feedback: message-only search is
  // "pretty dumb" — a request with no matching message (or none at all)
  // was unfindable even when its name/title/type were an obvious match.
  const matchingRequestIds = useMemo(() => {
    if (!searchQuery.trim()) return null; // null = "no search active", not "matched nothing"
    const ids = new Set(searchIndex(searchEntries, searchQuery).map((e) => e.requestId));
    for (const r of requests ?? []) {
      if (matchesPlainFields(r, searchQuery)) ids.add(r.id);
    }
    return ids;
  }, [searchEntries, searchQuery, requests]);

  // A search in progress bypasses sort/filter/group entirely — search
  // means "show me every match across the whole list," not "respect
  // whatever sort/filter/group happens to be set" (same reasoning
  // RequestList's own search used).
  const sorted = useMemo(() => {
    if (!requests) return [];
    // Searching and not-searching are textually distinct branches instead
    // of routing both through filterRequests via a magic "all" sentinel
    // (Sibling review finding — that meant a reader had to open
    // filterRequests to learn "all" means "no-op passthrough").
    // Sibling review finding: this used to call sortRequests
    // unconditionally, so an active search still applied the (disabled,
    // supposedly inert) Sort dropdown's stale value — contradicting the
    // comment above and the disabled UI's implication that sort no
    // longer applies during a search.
    if (matchingRequestIds) {
      return requests.filter((r) => matchingRequestIds.has(r.id));
    }
    return sortRequests(filterRequests(requests, filter), sort);
  }, [requests, filter, sort, matchingRequestIds]);

  // One shape either way — a list of groups, ungrouped is just one group
  // holding everything (Sibling review finding: two near-identical render
  // blocks, kept in sync by hand, collapsed into a single map below).
  // groupByPerson over an already-sorted/filtered admin-scale array is
  // cheap enough not to need its own memo separate from `sorted`.
  //
  // isGrouped named once (Sibling review finding) — the render key below
  // used to re-derive this same condition independently, a future edit to
  // the grouping rule could update one and silently miss the other.
  const isGrouped = group === "person" && !matchingRequestIds;
  const groups = isGrouped ? groupByPerson(sorted) : [sorted];

  // "+ New request" renders in EVERY state below (error, loading,
  // loaded) — creating a request has nothing to do with whether the
  // existing list could be fetched (same reasoning RequestList's own
  // button uses; a real bug in an earlier draft of this fix put the
  // button after the error/loading early-returns, so it silently
  // vanished whenever the list hadn't finished loading — caught live,
  // Gavi couldn't find the button at all).
  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 560 }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 560 }}>
        <Button variant="primary" onClick={onNewRequest}>
          + New request
        </Button>
        <Card>Loading…</Card>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 560 }}>
      <Button variant="primary" onClick={onNewRequest}>
        + New request
      </Button>

      <Input
        type="search"
        placeholder="Search conversations…"
        aria-label="Search conversations"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Persistent sort/filter/group row (decision #46) — always visible
          at top, not tucked behind a toggle. Disabled during an active
          search — search shows every match regardless of sort/filter/
          group, same reasoning RequestList's own search used. */}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Select id="admin-sort" label="Sort" options={SORT_OPTIONS} value={sort} onChange={(e) => setSort(e.target.value)} disabled={!!matchingRequestIds} />
        <Select id="admin-filter" label="Filter" options={FILTER_OPTIONS} value={filter} onChange={(e) => setFilter(e.target.value)} disabled={!!matchingRequestIds} />
        <Select id="admin-group" label="Group" options={GROUP_OPTIONS} value={group} onChange={(e) => setGroup(e.target.value)} disabled={!!matchingRequestIds} />
      </div>

      {sorted.length === 0 && (
        <p>{matchingRequestIds ? "No matching conversations." : "No requests match this filter."}</p>
      )}

      {groups.map((groupRequests, i) => (
        // Ungrouped (or searching): one group, key by position (stable,
        // only one ever exists). Grouped: key by the group's own userId.
        <div key={isGrouped ? groupRequests[0]?.userId : i} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {groupRequests.map((r) => (
            <AdminRequestRow key={r.id} request={r} onClick={() => onOpenRequest(r.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default AdminList;
