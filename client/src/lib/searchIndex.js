// Admin client-side search index: decrypt and build searchable message index.
// No server-side plaintext storage; search happens in admin's browser.

import { getConversationKey, decryptMessageContent } from './conversationCrypto.js'

// Build searchable index: decrypt messages up-front, skip failures (isolated per request via Promise.all).
// One entry per message with real text; corrupted/missing-key messages skipped.
export async function buildSearchIndex(requests) {
  const perRequest = await Promise.all(
    requests.map(async (req) => {
      if (!req.message?.length) return []
      try {
        // Only derive key if request has encrypted messages (skip plaintext-only requests).
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
