// FRONTEND_URL is only used to build a Telegram deep link
export function buildPermalink(publicId) {
  return process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/r/${publicId}` : undefined
}
