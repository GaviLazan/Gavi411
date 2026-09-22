import { useEffect, useState } from 'react'
import { useUser } from '@clerk/react'
import {
  getStashedInviteToken,
  clearStashedInviteToken,
  getStashedInvitePassphrase,
  clearStashedInvitePassphrase,
  getStashedRecoveryParams,
} from './lib/inviteToken'
import { createAndUploadEscrowBackup, createAndUploadKeypair } from './lib/escrow'
import { loadLinkedConversationKeys, wrapMissingConversationKeys } from './lib/deviceLinking'
import { seedLinkedConversationKeys } from './lib/conversationCrypto'
import { loadPrivateKey } from './lib/keyStore'
import { E2E_ENABLED } from './lib/e2eConfig'

// Auth/bootstrap state: invite-token validation for signed-out visitors,
// the invite-claim token handoff for a fresh signup, role/profile fetch
// once signed in, and the admin device-key self-heal sweep. Everything
// here only depends on Clerk's isSignedIn — App.jsx's view/navigation
// state stays separate and consumes this hook's resolved values.
export function useSession() {
  const { isSignedIn, user } = useUser()

  const [inviteTokenState, setInviteTokenState] = useState('checking') // 'checking' | 'valid' | 'invalid'
  useEffect(() => {
    if (isSignedIn) return
    const token = getStashedInviteToken()
    if (!token) {
      setInviteTokenState('invalid')
      return
    }
    fetch(`/api/invites/${encodeURIComponent(token)}/valid`)
      .then((res) => res.json())
      .then((data) => setInviteTokenState(data.valid ? 'valid' : 'invalid'))
      .catch(() => setInviteTokenState('invalid'))
  }, [isSignedIn])

  // Nothing else that needs auth renders/fires until this handoff has
  // settled (or there was nothing to send) — starts true when there's no
  // stashed token, since only signups need to wait.
  const [tokenHandoffDone, setTokenHandoffDone] = useState(() => !getStashedInviteToken())
  const [escrowBackupFailed, setEscrowBackupFailed] = useState(false)

  // Device-linking: once per sign-in, seed any approved-but-not-yet-loaded
  // conversation keys — a no-op for every device that never requested
  // linking.
  useEffect(() => {
    if (!isSignedIn) return
    loadLinkedConversationKeys().then(seedLinkedConversationKeys).catch(() => {})
  }, [isSignedIn])

  useEffect(() => {
    if (!isSignedIn) return
    const token = getStashedInviteToken()
    if (!token) {
      setTokenHandoffDone(true)
      return
    }
    // AbortController: React StrictMode double-invokes this effect on
    // mount, which would otherwise fire two real requests carrying the
    // same one-time-use token. Aborting the first on cleanup means only
    // the second, real invocation's request reaches the server.
    const controller = new AbortController()
    let claimSucceeded = false
    fetch('/api/requests', { headers: { 'x-invite-token': token }, signal: controller.signal })
      .then((res) => { claimSucceeded = res.ok })
      .catch(() => {}) // AbortError on cleanup is expected, not a real failure
      .finally(async () => {
        if (controller.signal.aborted) return
        clearStashedInviteToken()
        // Every successful signup gets a real E2E-messaging keypair,
        // whether or not this invite link carried an escrow passphrase.
        const passphrase = getStashedInvitePassphrase()
        if (claimSucceeded && passphrase) {
          const ok = await createAndUploadEscrowBackup(token, passphrase)
          if (!ok) setEscrowBackupFailed(true)
        } else if (claimSucceeded) {
          const ok = await createAndUploadKeypair()
          if (!ok) setEscrowBackupFailed(true)
        }
        clearStashedInvitePassphrase()
        if (controller.signal.aborted) return
        setTokenHandoffDone(true)
      })
    return () => controller.abort()
  }, [isSignedIn])

  // role isn't on the Clerk user object (it's our own Prisma field) —
  // fetch it once via /api/me. A 403 means Clerk auth succeeded but our
  // own backend never created a User row (no valid invite).
  const [role, setRole] = useState(null)
  const isAdmin = role === 'ADMIN'
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false)
  const [userProfilePic, setUserProfilePic] = useState(null)
  const [fetchedUser, setFetchedUser] = useState(null)
  const showsCreditRing = isSignedIn && !isAdmin && fetchedUser?.creditBalance !== undefined
  const [unauthorized, setUnauthorized] = useState(false)
  const [roleFetchFailed, setRoleFetchFailed] = useState(false)
  const [roleRetryToken, setRoleRetryToken] = useState(0)
  const retryRole = () => setRoleRetryToken((t) => t + 1)

  const [recovery, setRecovery] = useState(getStashedRecoveryParams)
  const clearRecovery = () => setRecovery({ token: null, passphrase: null })

  useEffect(() => {
    if (!isSignedIn || !tokenHandoffDone) return
    setRoleFetchFailed(false)
    fetch('/api/me')
      .then((res) => {
        if (res.status === 403) {
          setUnauthorized(true)
          return null
        }
        if (!res.ok) throw new Error('failed')
        return res.json()
      })
      .then((data) => {
        if (data) {
          setRole(data.user?.role ?? null)
          const phoneNumber = data.user?.phoneNumber
          setNeedsProfileCompletion(phoneNumber?.startsWith('pending-') ?? false)
          setUserProfilePic(data.user?.profilePic ?? null)
          setFetchedUser(data.user)
        }
      })
      .catch(() => setRoleFetchFailed(true))
  }, [isSignedIn, tokenHandoffDone, roleRetryToken])

  // Admin device-key self-heal sweep: only admin's browser ever holds the
  // private key needed to wrap a conversation key for a linked device, so
  // this can't run until role resolves to ADMIN.
  useEffect(() => {
    if (!E2E_ENABLED || role !== 'ADMIN') return
    loadPrivateKey().then((key) => {
      if (key) wrapMissingConversationKeys(key)
    })
  }, [role])

  return {
    isSignedIn,
    user,
    inviteTokenState,
    tokenHandoffDone,
    escrowBackupFailed,
    dismissEscrowBackupFailed: () => setEscrowBackupFailed(false),
    role,
    isAdmin,
    needsProfileCompletion,
    clearNeedsProfileCompletion: () => setNeedsProfileCompletion(false),
    userProfilePic,
    fetchedUser,
    setFetchedUser,
    setUserProfilePic,
    showsCreditRing,
    unauthorized,
    roleFetchFailed,
    roleRetryToken,
    retryRole,
    recovery,
    clearRecovery,
  }
}
