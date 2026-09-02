import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Select from "../components/Select";
import { statusLabel } from "./RequestList";
import { timeSince, lastActivityAt, filterRequests, sortRequests, groupByPerson } from "../lib/adminListSort";

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

  const sorted = useMemo(() => {
    if (!requests) return [];
    return sortRequests(filterRequests(requests, filter), sort);
  }, [requests, filter, sort]);

  // One shape either way — a list of groups, ungrouped is just one group
  // holding everything (Sibling review finding: two near-identical render
  // blocks, kept in sync by hand, collapsed into a single map below).
  // groupByPerson over an already-sorted/filtered admin-scale array is
  // cheap enough not to need its own memo separate from `sorted`.
  const groups = group === "person" ? groupByPerson(sorted) : [sorted];

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
      {/* Persistent sort/filter/group row (decision #46) — always visible
          at top, not tucked behind a toggle. */}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Select id="admin-sort" label="Sort" options={SORT_OPTIONS} value={sort} onChange={(e) => setSort(e.target.value)} />
        <Select id="admin-filter" label="Filter" options={FILTER_OPTIONS} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Select id="admin-group" label="Group" options={GROUP_OPTIONS} value={group} onChange={(e) => setGroup(e.target.value)} />
      </div>

      {sorted.length === 0 && <p>No requests match this filter.</p>}

      {groups.map((groupRequests, i) => (
        // Ungrouped: one group, key by position (stable, only one ever
        // exists). Grouped: key by the group's own userId.
        <div key={group === "person" ? groupRequests[0]?.userId : i} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {groupRequests.map((r) => (
            <AdminRequestRow key={r.id} request={r} onClick={() => onOpenRequest(r.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default AdminList;
