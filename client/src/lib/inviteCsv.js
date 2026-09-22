// CSV export for invite: label, "Gavi411", passphrase, notes.
// No header row (1Password treats it as a data row). Passphrase only exists in response.
export function inviteCsvRow(invite) {
  const row = [invite.label || '', 'Gavi411', invite.passphrase, '']
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

// Triggers a browser download of the CSV for one invite. Browser-only —
// not called from tests, same convention as keyStore.js.
export function downloadInviteCsv(invite) {
  const csv = inviteCsvRow(invite)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invite-${invite.token.slice(0, 8)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
