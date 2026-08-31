// CSV export for a just-created invite (G411-28 stage 4). Client-side
// only, by necessity: the passphrase exists exactly once, in the POST
// /api/invites response — there is no server endpoint to fetch it again
// later (see server/routes/invites.js, prisma/schema.prisma's
// PendingInvite comment), so the CSV can only ever be built from that one
// response, at that one moment. Matches PRD §5's "Gavi exports a CSV at
// invite-creation time."

// Pure row-building, split out from the download side-effect below so it
// can be unit-tested without touching the DOM (Blob/URL.createObjectURL
// aren't available in the Node test env — see crypto.test.js's doc
// comment on the same DOM-avoidance convention).
export function inviteCsvRow(invite) {
  const rows = [
    ['title', 'passphrase', 'notes'],
    [invite.label || '', invite.passphrase, ''],
  ]
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
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
