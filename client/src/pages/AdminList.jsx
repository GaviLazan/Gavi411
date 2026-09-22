import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Select from "../components/Select";
import Input from "../components/Input";
import Button from "../components/Button";
import { statusLabel } from "../lib/requestStatus";
import { timeSince, lastActivityAt, filterRequests, sortRequests, filterByUrgency, groupByPerson, matchesPlainFields } from "../lib/adminListSort";
import { buildSearchIndex, searchIndex } from "../lib/searchIndex";
import { loadLinkedConversationKeys } from "../lib/deviceLinking";
import { seedLinkedConversationKeys } from "../lib/conversationCrypto";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
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

// ── Avatar ──
// WhatsApp-style avatar: photo if present, initials otherwise
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

// ── Row ──
function AdminRequestRow({ request, onClick }) {
  const user = request.user;
  const friendName = user ? `${user.firstName} ${user.lastName}` : "Unknown";
  return (
    <button type="button" className="request-card-button" onClick={onClick}>
      <Card style={{ width: "100%", textAlign: "start", display: "flex", flexDirection: "row", gap: "var(--space-3)", alignItems: "center" }}>
        <Avatar user={user} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p dir="auto" style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            {request.urgency === "HIGH" && (
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--danger)",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
            )}
            {request.urgency === "LOW" && (
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--success)",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
            )}
            <span>
              {friendName}
              {request.type ? ` · ${statusLabel(request.type)}` : ""}
            </span>
          </p>
          <p dir="auto" style={{ color: "var(--text)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {request.freeText}
          </p>
        </div>
        <div style={{ textAlign: "end", flexShrink: 0, fontSize: 13 }}>
          <p style={{ fontWeight: 600 }}>{statusLabel(request.status)}</p>
          <p style={{ color: "var(--text)" }}>{statusLabel(request.urgency)}</p>
          <p style={{ color: "var(--text)" }}>{timeSince(lastActivityAt(request))}</p>
        </div>
      </Card>
    </button>
  );
}

// ── Main component ──
// sessionStorage key for sort/group/urgent-only preferences
const LIST_PREFS_STORAGE_KEY = "gavi411_admin_list_prefs";

function loadListPrefs() {
  try {
    const saved = sessionStorage.getItem(LIST_PREFS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function AdminList({ onOpenRequest, onNewRequest, filter: filterProp, onRequestsLoaded, refreshToken }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState(() => loadListPrefs().sort ?? "newest");
  const [filter, setFilter] = useState(filterProp ?? "open");
  const [group, setGroup] = useState(() => loadListPrefs().group ?? "none");
  const [urgentOnly, setUrgentOnly] = useState(() => loadListPrefs().urgentOnly ?? false);
  const [retryToken, setRetryToken] = useState(0);

  // Persist sort/group/urgentOnly preferences
  useEffect(() => {
    sessionStorage.setItem(LIST_PREFS_STORAGE_KEY, JSON.stringify({ sort, group, urgentOnly }));
  }, [sort, group, urgentOnly]);

  // filter is a controlled prop: track it on every change
  useEffect(() => {
    if (filterProp) setFilter(filterProp);
  }, [filterProp]);

  // Fetch list: lightweight by default, full messages only on search
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      try {
        const res = await fetch("/api/requests");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (!cancelled) {
          setRequests(data);
          onRequestsLoaded?.(data);
        }
      } catch {
        if (!cancelled) setError("Couldn't load the list. Try again?");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [retryToken, refreshToken]);

  const [searchEntries, setSearchEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRequests, setSearchRequests] = useState(null);

  // Lazy search: fetch full messages and build index only when searching
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

  // Match message content AND plaintext fields (name/title/type)
  const matchingRequestIds = useMemo(() => {
    if (!searchQuery.trim()) return null; // null = "no search active", not "matched nothing"
    const ids = new Set(searchIndex(searchEntries, searchQuery).map((e) => e.requestId));
    for (const r of requests ?? []) {
      if (matchesPlainFields(r, searchQuery)) ids.add(r.id);
    }
    return ids;
  }, [searchEntries, searchQuery, requests]);

  // Active search bypasses sort/filter/group
  const sorted = useMemo(() => {
    if (!requests) return [];
    if (matchingRequestIds) {
      return requests.filter((r) => matchingRequestIds.has(r.id));
    }
    return sortRequests(filterByUrgency(filterRequests(requests, filter), urgentOnly), sort);
  }, [requests, filter, sort, urgentOnly, matchingRequestIds]);

  // Ungrouped = one group holding everything; grouped by person otherwise
  const isGrouped = group === "person" && !matchingRequestIds;
  const groups = isGrouped ? groupByPerson(sorted) : [sorted];

  // "+ New ask" renders in all states (loading, error, loaded)
  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
        {onNewRequest && (
          <Button variant="primary" onClick={onNewRequest}>
            + New ask
          </Button>
        )}
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
        {onNewRequest && (
          <Button variant="primary" onClick={onNewRequest}>
            + New ask
          </Button>
        )}
        <Card>Loading…</Card>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
      {onNewRequest && (
        <Button variant="primary" onClick={onNewRequest}>
          + New ask
        </Button>
      )}

      <Input
        type="search"
        placeholder="Search conversations…"
        aria-label="Search conversations"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Sort/filter/group controls; disabled during search */}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
        <Select id="admin-sort" label="Sort" options={SORT_OPTIONS} value={sort} onChange={(e) => setSort(e.target.value)} disabled={!!matchingRequestIds} />
        <Select id="admin-filter" label="Filter" options={FILTER_OPTIONS} value={filter} onChange={(e) => setFilter(e.target.value)} disabled={!!matchingRequestIds} />
        <Select id="admin-group" label="Group" options={GROUP_OPTIONS} value={group} onChange={(e) => setGroup(e.target.value)} disabled={!!matchingRequestIds} />
        <label style={{ display: "flex", gap: "var(--space-1)", alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} disabled={!!matchingRequestIds} />
          <span>Urgent only</span>
        </label>
      </div>

      {sorted.length === 0 && (
        <p>{matchingRequestIds ? "No matching conversations." : "Nothing matches this filter."}</p>
      )}

      {groups.map((groupRequests, i) => (
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
