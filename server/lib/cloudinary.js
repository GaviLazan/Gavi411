// Cloudinary upload helper. The v2 SDK reads CLOUDINARY_URL from process.env.
import { v2 as cloudinary } from 'cloudinary'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
// Exported so the client can use the same list for file-input accept.
export const ALLOWED_IMAGE_TYPES = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
]
const ALLOWED_MIME_SET = new Set(ALLOWED_IMAGE_TYPES)

export function validateImage(file) {
  if (!ALLOWED_MIME_SET.has(file.mimetype)) {
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
