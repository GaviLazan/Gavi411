import Card from "../components/Card";
import { statusLabel } from "../lib/requestStatus";

export function RequestCard({ request, onClick }) {
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
