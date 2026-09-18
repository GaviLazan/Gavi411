import { statusLabel } from '../lib/requestStatus'
import './StatusChip.css'

const STATUS_STYLES = {
  IN_QUEUE: 'status-chip-accent',
  RECEIVED: 'status-chip-accent',
  WORKING_ON_IT: 'status-chip-gold',
  WAITING_ON_USER: 'status-chip-strong',
  RESOLVED_PENDING_CONFIRMATION: 'status-chip-success',
  OVERDRAFT_PENDING: 'status-chip-outline',
  OVERDRAFT_DENIED: 'status-chip-outline',
  CANCELLED: 'status-chip-outline',
  SELF_SOLVED: 'status-chip-outline',
  CLOSED: 'status-chip-outline',
}

export default function StatusChip({ status }) {
  const styleClass = STATUS_STYLES[status] || 'status-chip-outline'
  return (
    <span className={`status-chip ${styleClass}`}>
      <span className="status-chip-dot" />
      {statusLabel(status)}
    </span>
  )
}
