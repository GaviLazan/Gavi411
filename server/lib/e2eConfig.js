// Server twin of client/src/lib/e2eConfig.js — no shared package between the
// two deploy targets (Vercel/Render), so this is a small duplicated constant,
// not an import. Keep both in sync when E2E is reactivated (decision #98).
export const E2E_ENABLED = false
