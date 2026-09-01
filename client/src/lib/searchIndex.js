// Admin client-side search index (G411-28, remaining scope piece 1).
// Server only ever stores/relays ciphertext (G411-82) — search over
// message content has to happen in admin's own browser, after decrypting
// each conversation locally with keys admin already holds (admin is a
// party to every conversation). No server-side plaintext index, no
// server-side search endpoint.
//
// Kept separate from conversationCrypto.js (per-message send/receive
// glue) since this is a bulk, admin-only, read-only operation over every
// request at once, not a single conversation's live thread.

import { getConversationKey, decryptMessageContent } from './conversationCrypto.js'

// Builds a flat, searchable array from every request's messages: one
// entry per message that has real text (encrypted or legacy plaintext),
// decrypted up front so search itself is a plain in-memory string scan
// with no further async work — matches the "decrypt all on admin app
// load" call (an admin panel session is short-lived/low-traffic; this
// mirrors the same bulk-decrypt-up-front shape deviceLinking.js's
// approveDevice/wrapForRequests already uses for a comparable admin
// operation).
//
// `requests` is the array GET /api/requests?include=messages returns —
// each with a `message` array (Prisma's relation field name, singular,
// per prisma/schema.prisma). A message that fails to decrypt (no key,
// corrupt envelope) is skipped rather than included as noise — nothing
// useful to search in an opaque ciphertext failure.
//
// Sibling review findings (PR #36): every request is processed
// concurrently via Promise.all — each request's key derivation is an
// independent /public-keys round trip, so this also fixes the correctness
// bug the old sequential for-loop had: one request's getConversationKey
// throwing (a real network/WebCrypto exception, not just a non-ok
// response — that case was already outside the per-message try/catch)
// used to abort the ENTIRE index build for every remaining request. Each
// request's own try/catch now isolates that request's own failure
// instead.
export async function buildSearchIndex(requests) {
  const perRequest = await Promise.all(
    requests.map(async (req) => {
      if (!req.message?.length) return []
      try {
        // Only derive a shared key when this request actually has an
        // encrypted message to decrypt — a request with only legacy
        // plaintext rows (pre-G411-82) has nothing to unwrap, and
        // deriving a key it doesn't need means an unnecessary
        // /public-keys round trip per such request on every admin app
        // load.
        const hasEncrypted = req.message.some((m) => m.encrypted)
        const sharedKey = hasEncrypted ? await getConversationKey(req.id) : null

        const decrypted = await Promise.all(
          req.message.map(async (message) => {
            try {
              const text = await decryptMessageContent(sharedKey, message)
              return text ? { requestId: req.id, messageId: message.id, text } : null
            } catch {
              return null // corrupt envelope or similar — not searchable, not fatal to the rest of the index
            }
          }),
        )
        return decrypted.filter(Boolean)
      } catch {
        return [] // this request's key derivation failed (network/WebCrypto) — costs only this request, not the whole index
      }
    }),
  )

  return perRequest.flat()
}

// Plain case-insensitive substring match — the actual "search" over the
// index buildSearchIndex produces. No fuzzy/ranked search library: this
// is an admin convenience over a solo-admin's own message volume, not a
// product search feature with scale/relevance requirements.
export function searchIndex(entries, query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return entries.filter((e) => e.text.toLowerCase().includes(q))
}
