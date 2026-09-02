import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Select from "../components/Select";
import Input from "../components/Input";
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
          <p style={{ fontWeight: 600 }}>{statusLabel(request.urgency)}</p>
          <p style={{ color: "var(--text)" }}>{timeSince(lastActivityAt(request))}</p>
        </div>
      </Card>
    </button>
  );
}

function AdminList({ onOpenRequest }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("urgency");
  const [filter, setFilter] = useState("open");
  const [group, setGroup] = useState("none");
  const [retryToken, setRetryToken] = useState(0);

  // ?include=messages: needed for the search index below (full ordered
  // message bodies, not the narrow last-message-only shape the plain
  // route returns) — same fetch RequestList's admin branch always made.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      try {
        const res = await fetch("/api/requests?include=messages");
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

  // Same "decrypt all on admin app load" call RequestList made — an
  // admin session's message volume is small enough that one upfront
  // decrypt beats piecemeal per-keystroke decryption.
  useEffect(() => {
    loadLinkedConversationKeys().then(seedLinkedConversationKeys).catch(() => {});
  }, []);

  const [searchEntries, setSearchEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!requests) {
      setSearchEntries([]);
      return;
    }
    buildSearchIndex(requests)
      .then((entries) => {
        if (!cancelled) setSearchEntries(entries);
      })
      .catch(() => {
        if (!cancelled) setSearchEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [requests]);

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
    const base = matchingRequestIds ? requests.filter((r) => matchingRequestIds.has(r.id)) : requests;
    return sortRequests(filterRequests(base, matchingRequestIds ? "all" : filter), sort);
  }, [requests, filter, sort, matchingRequestIds]);

  // One shape either way — a list of groups, ungrouped is just one group
  // holding everything (Sibling review finding: two near-identical render
  // blocks, kept in sync by hand, collapsed into a single map below).
  // groupByPerson over an already-sorted/filtered admin-scale array is
  // cheap enough not to need its own memo separate from `sorted`.
  const groups = group === "person" && !matchingRequestIds ? groupByPerson(sorted) : [sorted];

  if (error) {
    return (
      <Card>
        <p>{error}</p>
        <button type="button" onClick={() => setRetryToken((t) => t + 1)}>Try again</button>
      </Card>
    );
  }

  if (requests === null) {
    return <Card>Loading…</Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 560 }}>
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
        <div key={group === "person" && !matchingRequestIds ? groupRequests[0]?.userId : i} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {groupRequests.map((r) => (
            <AdminRequestRow key={r.id} request={r} onClick={() => onOpenRequest(r.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default AdminList;
