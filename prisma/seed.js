// Trigger taxonomy seed data (G411-20). First-pass keyword list per
// RequestType — a handful of common terms per category, not exhaustive.
// Admin-editable UI to grow/edit this list live is G411-42, separate task.
// Run manually: node prisma/seed.js

import { prisma } from '../server/lib/prisma.js'

const triggers = [
  { keyword: 'flight', requestType: 'TRAVEL' },
  { keyword: 'hotel', requestType: 'TRAVEL' },
  { keyword: 'passport', requestType: 'TRAVEL' },
  { keyword: 'visa', requestType: 'TRAVEL' },
  { keyword: 'trip', requestType: 'TRAVEL' },
  { keyword: 'ticket', requestType: 'TRAVEL' },
  { keyword: 'travel', requestType: 'TRAVEL' },
  { keyword: 'go to', requestType: 'TRAVEL' },
  { keyword: 'airline', requestType: 'TRAVEL' },
  { keyword: 'airport', requestType: 'TRAVEL' },
  { keyword: 'layover', requestType: 'TRAVEL' },
  { keyword: 'delayed', requestType: 'TRAVEL' },
  { keyword: 'cancelled', requestType: 'TRAVEL' },
  { keyword: 'boarding', requestType: 'TRAVEL' },
  { keyword: 'luggage', requestType: 'TRAVEL' },
  { keyword: 'rental car', requestType: 'TRAVEL' },
  { keyword: 'booking', requestType: 'TRAVEL' },
  { keyword: 'itinerary', requestType: 'TRAVEL' },

  { keyword: 'review', requestType: 'RESEARCH' },
  { keyword: 'compare', requestType: 'RESEARCH' },
  { keyword: 'recommend', requestType: 'RESEARCH' },
  { keyword: 'research', requestType: 'RESEARCH' },
  { keyword: 'look up', requestType: 'RESEARCH' },
  { keyword: 'find', requestType: 'RESEARCH' },

  { keyword: 'buy', requestType: 'PURCHASE' },
  { keyword: 'order', requestType: 'PURCHASE' },
  { keyword: 'ship', requestType: 'PURCHASE' },
  { keyword: 'purchase', requestType: 'PURCHASE' },
  { keyword: 'get', requestType: 'PURCHASE' },
  { keyword: 'price', requestType: 'PURCHASE' },
  { keyword: 'deal', requestType: 'PURCHASE' },
  { keyword: 'discount', requestType: 'PURCHASE' },
  { keyword: 'cheapest', requestType: 'PURCHASE' },
  { keyword: 'where to buy', requestType: 'PURCHASE' },
  { keyword: 'amazon', requestType: 'PURCHASE' },
  { keyword: 'delivery', requestType: 'PURCHASE' },
  { keyword: 'return', requestType: 'PURCHASE' },

  { keyword: 'wifi', requestType: 'TECH_SUPPORT' },
  { keyword: 'router', requestType: 'TECH_SUPPORT' },
  { keyword: 'password', requestType: 'TECH_SUPPORT' },
  { keyword: 'computer', requestType: 'TECH_SUPPORT' },
  { keyword: 'phone', requestType: 'TECH_SUPPORT' },
  { keyword: 'android', requestType: 'TECH_SUPPORT' },
  { keyword: 'iphone', requestType: 'TECH_SUPPORT' },
  { keyword: 'ios', requestType: 'TECH_SUPPORT' },
  { keyword: 'windows', requestType: 'TECH_SUPPORT' },
  { keyword: 'mac', requestType: 'TECH_SUPPORT' },
  { keyword: 'linux', requestType: 'TECH_SUPPORT' },
  { keyword: 'crashed', requestType: 'TECH_SUPPORT' },

  { keyword: 'question', requestType: 'INFO' },
  { keyword: 'how do i', requestType: 'INFO' },
  { keyword: 'what is', requestType: 'INFO' },
  { keyword: 'where is', requestType: 'INFO' },
  { keyword: 'when is', requestType: 'INFO' },
  { keyword: "i don't know", requestType: 'INFO' },
  { keyword: 'figure out', requestType: 'INFO' },
]
// GENERAL has no keywords — it's the fallback category when nothing
// else matches, not something meant to be typed into.

async function main() {
  // skipDuplicates relies on the @@unique([keyword, requestType]) constraint
  // (added 2026-08-24) so reruns don't double-insert rows.
  const { count } = await prisma.trigger.createMany({ data: triggers, skipDuplicates: true })
  console.log(`Seeded ${count} new triggers (${triggers.length - count} already existed).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
