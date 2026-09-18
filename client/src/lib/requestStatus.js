export const CLOSED_STATUSES = ["CLOSED", "CANCELLED", "SELF_SOLVED", "OVERDRAFT_DENIED"];

export function statusLabel(status) {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
