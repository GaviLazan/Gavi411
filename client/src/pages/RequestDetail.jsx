import { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { statusLabel as labelize } from "./RequestList";
// This page reuses ReviewSummary's .review-row/.review-label/.review-value
// classes for its own read-only rows — imported directly (Sibling review
// finding: it used to only work by relying on NewRequest.jsx importing
// this CSS first into the same eagerly-bundled app).
import "../components/ReviewSummary.css";

// Request detail / "ticket" page (G411-75). Minimum scope per the ticket:
// the request's own fields + urgency/status + the existing Message thread
// (schema's supported it since G411-67, never rendered anywhere until now).
// Read-only — no reply/compose UI, since no POST /messages route exists
// yet (out of scope here, would need its own ticket).

// typeDetails' keys are freeform per-type (TravelFields/PurchaseFields/
// TechSupportFields), no shared spec list like ReviewSummary.jsx's — that
// file's SPECS constants are review-screen-only (paired with edit
// controls this read-only page doesn't have). Camel-case keys get the
// same word-split treatment as status/type instead of a hand-maintained
// label map, since this page's job is "show whatever was saved," not
// per-type-tuned copy.
function fieldLabel(key) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced[0].toUpperCase() + spaced.slice(1);
}

function typeDetailRows(details, keyPrefix = "") {
  if (!details || typeof details !== "object") return [];
  return Object.entries(details).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.flatMap((entry, i) => typeDetailRows(entry, `${keyPrefix}${key} ${i + 1} — `));
    }
    if (typeof value === "object") {
      return typeDetailRows(value, `${keyPrefix}${fieldLabel(key)} — `);
    }
    return (
      <div className="review-row" key={keyPrefix + key}>
        <span className="review-label">{keyPrefix}{fieldLabel(key)}</span>
        <span className="review-value" dir="auto">{String(value)}</span>
      </div>
    );
  });
}

function RequestDetail({ requestId, onBack }) {
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setRequest(null);
    setError("");

    fetch(`/api/requests/${requestId}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setRequest(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this request.");
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (error) {
    return (
      <Card>
        <p>{error}</p>
        <Button onClick={onBack}>Back</Button>
      </Card>
    );
  }

  if (!request) {
    return <Card>Loading…</Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 420 }}>
      <Button variant="secondary" onClick={onBack}>← Back</Button>

      <Card className="review-summary">
        <h2>Request details</h2>
        <div className="review-row">
          <span className="review-label">Issue/Request</span>
          <span className="review-value" dir="auto">{request.freeText}</span>
        </div>
        <div className="review-row">
          <span className="review-label">Status</span>
          <span className="review-value">{labelize(request.status)}</span>
        </div>
        <div className="review-row">
          <span className="review-label">Urgency</span>
          <span className="review-value">{labelize(request.urgency)}</span>
        </div>
        {request.type && (
          <div className="review-row">
            <span className="review-label">Type</span>
            <span className="review-value">{labelize(request.type)}</span>
          </div>
        )}
        {request.additionalInfo && (
          <div className="review-row">
            <span className="review-label">Anything else</span>
            <span className="review-value" dir="auto">{request.additionalInfo}</span>
          </div>
        )}
        {typeDetailRows(request.typeDetails)}
      </Card>

      <Card>
        <h2>Messages</h2>
        {request.message.length === 0 ? (
          <p className="review-empty">No messages yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {request.message.map((m) => (
              <div className="review-row" key={m.id}>
                <span className="review-label">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
                <span className="review-value" dir="auto">{m.content}</span>
                {m.imageUrl && (
                  <img src={m.imageUrl} alt="" style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)" }} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default RequestDetail;
