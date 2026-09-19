import { describe, it, expect } from "vitest";
import { timeSince, lastActivityAt, filterRequests, sortRequests, filterByUrgency, groupByPerson, matchesPlainFields } from "./adminListSort";

describe("timeSince", () => {
  it("formats minutes for a recent timestamp", () => {
    const now = Date.now();
    expect(timeSince(new Date(now - 5 * 60000).toISOString(), now)).toBe("5 minutes ago");
  });

  it("formats hours once past an hour", () => {
    const now = Date.now();
    expect(timeSince(new Date(now - 3 * 3600000).toISOString(), now)).toBe("3 hours ago");
  });

  it("formats days once past a day", () => {
    const now = Date.now();
    expect(timeSince(new Date(now - 2 * 86400000).toISOString(), now)).toBe("2 days ago");
  });
});

describe("lastActivityAt", () => {
  it("uses the last message's createdAt when messages exist", () => {
    const request = {
      createdAt: "2026-01-01T00:00:00.000Z",
      message: [{ createdAt: "2026-01-02T00:00:00.000Z" }, { createdAt: "2026-01-03T00:00:00.000Z" }],
    };
    expect(lastActivityAt(request)).toBe("2026-01-03T00:00:00.000Z");
  });

  it("falls back to the request's own createdAt with no messages", () => {
    const request = { createdAt: "2026-01-01T00:00:00.000Z", message: [] };
    expect(lastActivityAt(request)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("falls back to createdAt when message is absent entirely", () => {
    const request = { createdAt: "2026-01-01T00:00:00.000Z" };
    expect(lastActivityAt(request)).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("filterRequests", () => {
  const requests = [
    { id: 1, status: "IN_QUEUE" },
    { id: 2, status: "CLOSED" },
    { id: 3, status: "CANCELLED" },
    { id: 4, status: "WORKING_ON_IT" },
  ];

  it("open excludes closed/cancelled/self-solved", () => {
    expect(filterRequests(requests, "open").map((r) => r.id)).toEqual([1, 4]);
  });

  it("closed includes only closed/cancelled/self-solved", () => {
    expect(filterRequests(requests, "closed").map((r) => r.id)).toEqual([2, 3]);
  });

  it("all returns everything unfiltered", () => {
    expect(filterRequests(requests, "all")).toEqual(requests);
  });
});

describe("sortRequests", () => {
  it("sorts by createdAt oldest first when order is 'oldest'", () => {
    const requests = [
      { id: 1, createdAt: "2026-01-02T00:00:00.000Z" },
      { id: 2, createdAt: "2026-01-03T00:00:00.000Z" },
      { id: 3, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(sortRequests(requests, "oldest").map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it("sorts by createdAt newest first when order is 'newest'", () => {
    const requests = [
      { id: 1, createdAt: "2026-01-02T00:00:00.000Z" },
      { id: 2, createdAt: "2026-01-03T00:00:00.000Z" },
      { id: 3, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(sortRequests(requests, "newest").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it("does not mutate the input array", () => {
    const requests = [
      { id: 1, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: 2, createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    const original = [...requests];
    sortRequests(requests, "oldest");
    expect(requests).toEqual(original);
  });
});

describe("filterByUrgency", () => {
  const requests = [
    { id: 1, urgency: "HIGH" },
    { id: 2, urgency: "LOW" },
    { id: 3, urgency: "HIGH" },
    { id: 4, urgency: "NORMAL" },
  ];

  it("returns only HIGH urgency requests when urgentOnly is true", () => {
    expect(filterByUrgency(requests, true).map((r) => r.id)).toEqual([1, 3]);
  });

  it("returns all requests when urgentOnly is false", () => {
    expect(filterByUrgency(requests, false)).toEqual(requests);
  });

  it("does not mutate the input array", () => {
    const original = [...requests];
    filterByUrgency(requests, true);
    expect(requests).toEqual(original);
  });
});

describe("groupByPerson", () => {
  it("groups requests by userId, preserving each group's incoming order", () => {
    const requests = [
      { id: 1, userId: "u1" },
      { id: 2, userId: "u2" },
      { id: 3, userId: "u1" },
    ];
    const groups = groupByPerson(requests);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((r) => r.id)).toEqual([1, 3]);
    expect(groups[1].map((r) => r.id)).toEqual([2]);
  });
});

describe("matchesPlainFields", () => {
  const request = {
    user: { firstName: "Ada", lastName: "Lovelace" },
    freeText: "Need a hotel in Rome",
    type: "TRAVEL",
  };

  it("matches on friend name, case-insensitive", () => {
    expect(matchesPlainFields(request, "ada")).toBe(true);
    expect(matchesPlainFields(request, "LOVELACE")).toBe(true);
  });

  it("matches on request title/freeText", () => {
    expect(matchesPlainFields(request, "hotel")).toBe(true);
  });

  it("matches on request type", () => {
    expect(matchesPlainFields(request, "travel")).toBe(true);
  });

  it("does not match an unrelated query", () => {
    expect(matchesPlainFields(request, "purchase")).toBe(false);
  });

  it("returns false for an empty query", () => {
    expect(matchesPlainFields(request, "")).toBe(false);
    expect(matchesPlainFields(request, "   ")).toBe(false);
  });

  it("handles a request with no user (defensive)", () => {
    const noUser = { ...request, user: null };
    expect(matchesPlainFields(noUser, "ada")).toBe(false);
    expect(matchesPlainFields(noUser, "hotel")).toBe(true);
  });
});
