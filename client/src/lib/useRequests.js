import { useEffect, useState } from 'react'

// Shared hook for fetching requests with cancelled flag + error handling,
// used by FriendRequestsList.
export function useRequests() {
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError('')
      try {
        const res = await fetch('/api/requests')
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) setRequests(data)
      } catch {
        if (!cancelled) setError("Couldn't load requests. Try again?")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [retryToken])

  return { requests, error, retry: () => setRetryToken((t) => t + 1) }
}
