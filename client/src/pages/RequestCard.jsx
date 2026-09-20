import Card from "../components/Card";
import StatusChip from "../components/StatusChip";
import { statusLabel } from "../lib/requestStatus";

export function RequestCard({ request, onClick, showStatusChip, showLastMessage, showMeta, lastMessageSender, lastMessagePreview, meta }) {
  return (
    <button type="button" className="request-card-button" onClick={onClick}>
      <Card style={{ width: "100%", textAlign: "start" }}>
        <p dir="auto" style={{ fontWeight: 600, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {request.freeText}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {showStatusChip ? (
            <StatusChip status={request.status} />
          ) : (
            <p style={{ color: "var(--text)", fontSize: 14, margin: 0 }}>
              {statusLabel(request.status)}
              {request.type ? ` · ${statusLabel(request.type)}` : ""}
            </p>
          )}
        </div>
        {showLastMessage && lastMessagePreview && (
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: "var(--space-2)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lastMessageSender}: {lastMessagePreview}
          </p>
        )}
        {showMeta && meta && (
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: "var(--space-1)", margin: 0 }}>
            {meta}
          </p>
        )}
      </Card>
    </button>
  );
}
