export const CLOSED_STATUSES = ["CLOSED", "CANCELLED", "SELF_SOLVED", "OVERDRAFT_DENIED"];

const STATUS_LABELS = {
  IN_QUEUE: "Submitted",
  RECEIVED: "Seen",
  WORKING_ON_IT: "On it",
  WAITING_ON_USER: "Waiting on you",
  RESOLVED_PENDING_CONFIRMATION: "Done? Confirm",
  CLOSED: "Done",
  CANCELLED: "Cancelled",
  SELF_SOLVED: "Sorted it yourself",
  OVERDRAFT_PENDING: "Waiting for approval",
  OVERDRAFT_DENIED: "Not approved",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}
