// CSV export for invite: title, name, password, site — title and name are
// both the invite's label (Gavi's call: makes password-manager import
// quicker). No header row (1Password treats it as a data row). Passphrase
// only exists in response.
export function inviteCsvRow(invite) {
  const row = [invite.label || '', invite.label || '', invite.passphrase, 'Gavi411']
  return row.map(csvEscape).join(',')
}

// Quotes a field if it contains a comma, quote, or newline; doubles any
// embedded quotes — standard CSV escaping (RFC 4180).
function csvEscape(value) {
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Triggers a browser download of one CSV containing one row per invite —
// used for both the single-invite export and the bulk-generate export.
// Browser-only — not called from tests, same convention as keyStore.js.
export function downloadInvitesCsv(invites) {
  const csv = invites.map(inviteCsvRow).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = invites.length === 1
    ? `invite-${invites[0].token.slice(0, 8)}.csv`
    : `invites-${invites.length}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
