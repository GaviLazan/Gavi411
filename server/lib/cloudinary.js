// Cloudinary upload helper (G411-26). The v2 SDK reads CLOUDINARY_URL from
// process.env automatically (already loaded globally via dotenv/config in
// server.js) — no manual config() call needed as long as that ran first.
import { v2 as cloudinary } from 'cloudinary'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB, Gavi's call (G411-26)
const ALLOWED_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
])

export function validateImage(file) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return 'Unsupported image type'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image too large (10MB max)'
  }
  return null
}

// Uploads a buffer (multer memoryStorage) via Cloudinary's upload_stream —
// the SDK's file-path upload() doesn't accept an in-memory buffer directly.
export function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', folder: 'gavi411-messages' },
      (err, result) => (err ? reject(err) : resolve(result)),
    )
    stream.end(buffer)
  })
}
