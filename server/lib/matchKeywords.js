// Keyword-matching engine (G411-19).
// Given free text, look up the DB-backed Trigger table and return the
// distinct RequestTypes whose keyword appears in the text. Deterministic,
// no LLM — case-insensitive substring match, run once (called from the
// frontend's Continue action, not live/debounced).
// ponytail: substring match, not word-boundary-aware — "light" would
// match inside "flights". Tracked as G411-63, not fixed here.

import { prisma } from './prisma.js'

export async function matchKeywords(freeText) {
  const text = freeText.toLowerCase()
  const triggers = await prisma.trigger.findMany()

  const matchedTypes = new Set()
  for (const trigger of triggers) {
    if (text.includes(trigger.keyword.toLowerCase())) {
      matchedTypes.add(trigger.requestType)
    }
  }

  return [...matchedTypes]
}
