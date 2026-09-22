// Given free text, looks up the DB-backed Trigger table and returns the
// distinct RequestTypes whose keyword appears in the text. Deterministic,
// no LLM — case-insensitive word-boundary match, run once.
//
// Word boundaries use Unicode property escapes (\p{L}\p{N}), not \b/\w —
// \b is ASCII-only and doesn't treat Hebrew letters as word characters,
// which would break bidi text. Keywords may be multi-word phrases, so
// boundaries are checked at the phrase's start/end, not per inner word.

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
