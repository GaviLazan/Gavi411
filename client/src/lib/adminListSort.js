// Pure sort/filter/timeSince logic for the admin list screen (G411-37),
// pulled out of AdminList.jsx so it has a real test — this codebase's
// convention is lib/ logic gets tested, page components don't (no
// component-test framework installed here).

import { CLOSED_STATUSES } from "../pages/RequestList";

export const URGENCY_ORDER = { LOW: 0, NORMAL: 1, HIGH: 2 };
export { CLOSED_STATUSES };

// Native Intl, no dependency — "time since last activity" per decision
// #46 (gavi411-brain.md).
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

// Urgency descending, then createdAt ascending as the tiebreak within
// each urgency band (decision #46: "urgency oldest-first default").
export function sortRequests(requests, sort) {
  const copy = [...requests];
  if (sort === "urgency") {
    copy.sort((a, b) => {
      const urgencyDiff = URGENCY_ORDER[b.urgency] - URGENCY_ORDER[a.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  } else {
    copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return copy;
}

// Plaintext-field match against a request's name/title/type — no
// decryption needed, unlike message content (see searchIndex.js). Gavi's
// direct feedback: message-only search silently failed for a request
// with no matching message (or none at all), even when its name/title/
// type were an obvious match.
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
