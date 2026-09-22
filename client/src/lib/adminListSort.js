// Admin list sort/filter logic: extracted for testing.

import { CLOSED_STATUSES } from "./requestStatus";

export const URGENCY_ORDER = { LOW: 0, NORMAL: 1, HIGH: 2 };
export { CLOSED_STATUSES };

// Native Intl.RelativeTimeFormat for "time since" display.
const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function timeSince(dateString, now = Date.now()) {
  const diffMs = new Date(dateString).getTime() - now;
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 60) return RTF.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return RTF.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return RTF.format(diffDays, "day");
}

// Falls back to the request's own createdAt when it has no messages yet —
// same "last activity" definition server/lib/autoClose.js's inactivity
// check uses, kept consistent here rather than reinventing it.
export function lastActivityAt(request) {
  const messages = request.message;
  if (Array.isArray(messages) && messages.length > 0) {
    return messages[messages.length - 1].createdAt;
  }
  return request.createdAt;
}

export function filterRequests(requests, filter) {
  if (filter === "all") return requests;
  const isClosed = (r) => CLOSED_STATUSES.includes(r.status);
  return requests.filter((r) => (filter === "closed" ? isClosed(r) : !isClosed(r)));
}

// Sort by creation date: "oldest" ascending, "newest" descending.
// Urgency filtering is now separate (see filterByUrgency).
export function sortRequests(requests, order) {
  const copy = [...requests];
  copy.sort((a, b) => {
    const diff = new Date(a.createdAt) - new Date(b.createdAt);
    return order === "oldest" ? diff : -diff;
  });
  return copy;
}

// Filter to only HIGH urgency requests if urgentOnly is true,
// otherwise return all requests unchanged.
export function filterByUrgency(requests, urgentOnly) {
  if (!urgentOnly) return requests;
  return requests.filter((r) => r.urgency === "HIGH");
}

// Search request name/title/type (no decryption needed, unlike message content).
export function matchesPlainFields(request, query) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const friendName = request.user ? `${request.user.firstName} ${request.user.lastName}` : "";
  const haystack = `${friendName} ${request.freeText} ${request.type ?? ""}`.toLowerCase();
  return haystack.includes(q);
}

export function groupByPerson(requests) {
  const map = new Map();
  for (const r of requests) {
    const key = r.userId;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.values()];
}
