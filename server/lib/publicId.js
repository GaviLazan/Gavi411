import crypto from 'crypto'

// Generate a unique public ID for sharing request permalinks
// Uses the same crypto.randomBytes().toString('base64url') convention as invites.js
export function generatePublicId() {
  return crypto.randomBytes(12).toString('base64url')
}
