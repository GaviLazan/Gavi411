// Shared PrismaClient instance — import this everywhere instead of `new PrismaClient()`
// per file (avoids exhausting DB connections in dev with --watch reloads).

import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
