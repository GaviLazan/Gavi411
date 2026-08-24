// Keyword-matching engine (G411-19).
// Given free text, look up the DB-backed Trigger table and return the
// distinct RequestTypes whose keyword appears in the text. Deterministic,
// no LLM — case-insensitive word-boundary match, run once (called from the
// frontend's Continue action, not live/debounced).
//
// Word boundaries use Unicode property escapes (\p{L}\p{N}), not \b/\w —
// \b is ASCII-only and does not treat Hebrew letters as word characters,
// which would break bidi text (G411-63). Keywords may be multi-word
// phrases (e.g. "go to", "rental car" — see prisma/seed.js), so boundaries
// are checked at the phrase's start/end, not per inner word.

import { prisma } from './prisma.js'

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wordBoundaryRegex(keyword) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(keyword)}(?![\\p{L}\\p{N}])`, 'iu')
}

export async function matchKeywords(freeText) {
  const triggers = await prisma.trigger.findMany()

  const matchedTypes = new Set()
  for (const trigger of triggers) {
    if (wordBoundaryRegex(trigger.keyword).test(freeText)) {
      matchedTypes.add(trigger.requestType)
    }
  }

  return [...matchedTypes]
}
