// Backfill script for G411-94: generate publicId for all existing requests
// Run with: node scripts/backfill-request-public-ids.js
// Safe to re-run — only touches requests where publicId IS NULL

import { prisma } from '../server/lib/prisma.js'
import { generatePublicId } from '../server/lib/publicId.js'

async function main() {
  try {
    // Find all requests without a publicId
    const nullRequests = await prisma.request.findMany({
      where: { publicId: null },
      select: { id: true },
    })

    console.log(`Found ${nullRequests.length} requests without publicId`)

    if (nullRequests.length === 0) {
      console.log('No backfill needed.')
      return
    }

    // Update each with a new unique publicId
    let updated = 0
    const failed = []
    for (const request of nullRequests) {
      try {
        await prisma.request.update({
          where: { id: request.id },
          data: { publicId: generatePublicId() },
        })
        updated++
      } catch (err) {
        // Unique constraint violation or other DB error
        failed.push({ id: request.id, error: err.message })
      }
    }

    console.log(`Updated ${updated} requests`)
    if (failed.length > 0) {
      console.error(`Failed to update ${failed.length} requests:`, failed)
    }

    // Verify no nulls remain
    const remaining = await prisma.request.count({ where: { publicId: null } })
    if (remaining > 0) {
      console.warn(`Warning: ${remaining} requests still have null publicId`)
      process.exit(1)
    }

    console.log('Backfill complete — all requests now have publicId')
  } catch (err) {
    console.error('Backfill failed:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
