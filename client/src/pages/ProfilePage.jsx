import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useUser, useClerk } from '@clerk/react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import './ProfilePage.css'

// Profile page (G411-80) — lets a friend view their account and update the
// one field Clerk can't manage: phone number (Clerk doesn't support Israeli
// numbers, see G411-69). Everything else Clerk already handles well in its
// own native, well-designed account modal (name, username, email, photo,
// password, connected accounts, sign-out-other-devices) — Gavi's call: we
// don't rebuild any of that, "Update account info" opens Clerk's own UI for
// it. Only phone gets its own small edit flow, right here.
//
// G411-108: exposes handleBack via ref so App.jsx's app-bar back button can
// trigger this screen's real exit logic (the Clerk sync below) instead of
// a plain setView — this screen no longer renders its own Back button.
//
// G411-112: onto the design system (Card/Button/Input/Select) — same
// layout for every account, friend or admin, since this is always the
// signed-in user's own data, never account-specific.
const ProfilePage = forwardRef(function ProfilePage({ user, onBack, onUpdated }, ref) {
  const { user: clerkUser } = useUser()
  const { openUserProfile, signOut } = useClerk()
  // G411-108: only sync-from-Clerk on the way out if the user actually
  // opened Clerk's own modal this visit — Gavi's live catch that the sync
  // fired (and blocked navigation on it) unconditionally, even when
  // nothing could have changed.
  const openedClerkModal = useRef(false)
  const [editingPhone, setEditingPhone] = useState(false)
  // Holds the option's own id (unique even when two options share a
  // calling code, e.g. US/CA both +1) — the Select needs a value that's
  // actually unique per option; the calling code itself is derived via
  // dialCodeOptions.find() wherever needed, see `dialCode` below.
  const [dialCodeId, setDialCodeId] = useState('IL')
  const [localNumber, setLocalNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState(null)

  // Real per-country grouping conventions, not guessed — dial code decides
  // which grouping applies. Israel's stored value already has its leading
  // 0 dropped (normalizePhoneNumber's job), so its prefix group is 2
  // digits, not 3 — a bug caught live (Gavi) in an earlier version of this
  // formatter that sliced 3 and produced "+972544-284668" instead of the
  // correct "+972 54-4284668".
  // id is the Select's own option value/key — distinct per country even
  // when two share a calling code (US/Canada both +1), since a native
  // <select> can't distinguish two <option>s with the same value (Sibling
  // review finding: the shared Select component keys by value, so the old
  // two bare "+1" entries collided — same country ambiguity a raw <select>
  // already had, just now a real key/value collision instead of a silent
  // one). code is still the actual dial code used everywhere else.
  const dialCodeOptions = [
    { id: 'IL', code: '+972', country: 'Israel', group: (d) => d.length > 2 ? [d.slice(0, 2), d.slice(2)].join('-') : d },
    { id: 'US', code: '+1', country: 'United States', group: groupNanp },
    { id: 'CA', code: '+1', country: 'Canada', group: groupNanp },
    { id: 'GB', code: '+44', country: 'United Kingdom', group: (d) => d.length > 4 ? [d.slice(0, 4), d.slice(4)].join(' ') : d },
    { id: 'FR', code: '+33', country: 'France', group: (d) => d.match(/.{1,2}/g)?.join(' ') ?? d },
    { id: 'DE', code: '+49', country: 'Germany', group: (d) => d.length > 3 ? [d.slice(0, 3), d.slice(3)].join(' ') : d },
    { id: 'AU', code: '+61', country: 'Australia', group: (d) => d.match(/.{1,3}/g)?.join(' ') ?? d },
  ]

  // NANP (US/Canada): XXX-XXX-XXXX.
  function groupNanp(d) {
    if (d.length !== 10) return d
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }

  const dialCode = dialCodeOptions.find((opt) => opt.id === dialCodeId)?.code ?? '+972'

  function matchDialCode(phoneNumber) {
    return [...dialCodeOptions]
      .sort((a, b) => b.code.length - a.code.length)
      .find((opt) => phoneNumber.startsWith(opt.code))
  }

  // Parse the stored phone number into dial code + local number whenever
  // the phone edit form opens, or the underlying user prop changes.
  useEffect(() => {
    if (!user?.phoneNumber) return
    const knownCode = matchDialCode(user.phoneNumber)
    if (knownCode) {
      setDialCodeId(knownCode.id)
      setLocalNumber(user.phoneNumber.slice(knownCode.code.length))
    } else {
      // Fallback for an unrecognized/local-only stored format.
      setLocalNumber(user.phoneNumber)
    }
  }, [user?.phoneNumber])

  function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return ''
    const knownCode = matchDialCode(phoneNumber)
    if (!knownCode) return phoneNumber
    const localPart = phoneNumber.slice(knownCode.code.length)
    return `${knownCode.code} ${knownCode.group(localPart)}`
  }

  function getPlaceholder() {
    if (dialCode === '+972') return 'e.g. 050-1234567'
    return 'Phone number'
  }

  function validatePhoneNumber() {
    const digitsOnly = localNumber.replace(/\D/g, '')
    const dialCodeDigits = dialCode.replace(/\D/g, '')
    const totalDigits = (dialCodeDigits + digitsOnly).length
    return totalDigits >= 8 && totalDigits <= 15
  }

  function normalizePhoneNumber() {
    const digitsOnly = localNumber.replace(/\D/g, '')
    const withoutLeadingZero = digitsOnly.startsWith('0')
      ? digitsOnly.slice(1)
      : digitsOnly
    return dialCode + withoutLeadingZero
  }

  // G411-80: our DB only pulls username/name/email from Clerk once, at
  // first-login signup — an edit made in Clerk's native account modal
  // (the "Update account info" button below) never reaches Prisma on its
  // own, not even after a sign-out/sign-in (found live — sign-in only
  // re-finds the existing row, it never re-creates it). Real fix is a
  // Clerk webhook (needs Gavi's dashboard access, out of scope here).
  // Cheaper stopgap: sync on the way out of this screen — the one place
  // in the app that sends someone to Clerk's modal — so a same-session
  // edit is caught without waiting for a reload. The server diffs
  // against Prisma and only writes what actually changed.
  function handleBack() {
    // Navigate immediately — the sync (when it runs at all) is a
    // best-effort background catch-up, not something worth making the
    // user wait on every exit for (Gavi's live catch).
    onBack()
    if (!openedClerkModal.current) return
    openedClerkModal.current = false
    fetch('/api/me/sync-from-clerk', { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.changed) {
          onUpdated(data.user)
          clerkUser?.reload()
        }
      })
      .catch(() => {
        // Best-effort — a failed sync shouldn't block anything, we've
        // already navigated away.
      })
  }

  useImperativeHandle(ref, () => ({ handleBack }))

  function startEditingPhone() {
    setError(null)
    setEditingPhone(true)
  }

  function cancelEditingPhone() {
    setError(null)
    // Re-parse from the last-saved value, discarding any in-progress edit.
    if (user?.phoneNumber) {
      const knownCode = matchDialCode(user.phoneNumber)
      if (knownCode) {
        setDialCodeId(knownCode.id)
        setLocalNumber(user.phoneNumber.slice(knownCode.code.length))
      } else {
        setLocalNumber(user.phoneNumber)
      }
    }
    setEditingPhone(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const normalizedPhone = normalizePhoneNumber()
    if (normalizedPhone === user?.phoneNumber) {
      setEditingPhone(false)
      return
    }
    if (!validatePhoneNumber()) {
      setError('Please enter a valid phone number')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: normalizedPhone }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update phone number')
      }

      const data = await res.json()
      onUpdated(data.user)
      setEditingPhone(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // G411-96: delete account
  async function handleDeleteAccount() {
    setDeleteError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/me', { method: 'DELETE' })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete account')
      }

      // Account deleted successfully — sign out
      await signOut()
    } catch (err) {
      setDeleteError(err.message)
      setSubmitting(false)
    }
  }

  function cancelDelete() {
    setConfirmingDelete(false)
    setConfirmText('')
    setDeleteError(null)
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '(not set)'
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?'

  return (
    <div className="profile-page">
      <Card>
        <div className="profile-avatar-row">
          {user?.profilePic ? (
            <img src={user.profilePic} alt="" className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar-fallback" aria-hidden="true">{initials}</div>
          )}
          <h2 dir="auto">{displayName}</h2>
        </div>

        <div className="profile-info-rows">
          <div className="profile-info-row">
            <span className="meta">Username</span>
            <span dir="auto">{user?.username || '(not set)'}</span>
          </div>
          <div className="profile-info-row">
            <span className="meta">Email</span>
            <span dir="auto">{user?.email || '(not set)'}</span>
          </div>
          {!editingPhone && (
            <div className="profile-info-row">
              <span className="meta">Phone</span>
              <span>{formatPhoneNumber(user?.phoneNumber) || '(not set)'}</span>
            </div>
          )}
        </div>

        {editingPhone && (
          <form onSubmit={handleSubmit} className="profile-phone-form">
            <Select
              id="profile-dial-code"
              label="Phone number"
              options={dialCodeOptions.map((opt) => ({ value: opt.id, label: `${opt.country} (${opt.code})` }))}
              value={dialCodeId}
              onChange={(e) => setDialCodeId(e.target.value)}
            />
            <Input
              id="profile-local-number"
              type="tel"
              value={localNumber}
              onChange={(e) => setLocalNumber(e.target.value)}
              placeholder={getPlaceholder()}
            />

            {error && <p role="alert" className="profile-error">{error}</p>}

            <div className="profile-actions">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelEditingPhone} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!editingPhone && (
          <div className="profile-actions">
            {/* Name/username/email/photo/password/connected-accounts/
                device-sign-out all live in Clerk's own account modal —
                Gavi's call: no need to duplicate a UI Clerk already does
                well. Only phone (Clerk-unsupported for Israeli numbers)
                gets a custom edit flow, above. */}
            <Button type="button" variant="secondary" onClick={() => { openedClerkModal.current = true; openUserProfile() }}>
              Update account info
            </Button>
            <Button type="button" variant="secondary" onClick={startEditingPhone}>
              Update phone number
            </Button>
          </div>
        )}

        {!editingPhone && (
          <Button type="button" variant="ghost" onClick={() => signOut()} className="profile-signout">
            Sign out
          </Button>
        )}

        {/* G411-96: account deletion */}
        {!editingPhone && (
          <div className="profile-delete-section">
            {!confirmingDelete ? (
              <Button type="button" variant="danger-text" onClick={() => setConfirmingDelete(true)}>
                Delete account
              </Button>
            ) : (
              <div className="profile-delete-confirm">
                <p>This will permanently delete your account. Type your first name to confirm.</p>
                <Input
                  id="profile-delete-confirm-name"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Enter your first name"
                />
                {deleteError && <p role="alert" className="profile-error">{deleteError}</p>}
                <div className="profile-actions">
                  <Button
                    type="button"
                    variant="danger-primary"
                    onClick={handleDeleteAccount}
                    disabled={submitting || confirmText.trim().toLowerCase() !== (user?.firstName?.toLowerCase() ?? '')}
                  >
                    {submitting ? 'Deleting…' : 'Delete my account'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={cancelDelete} disabled={submitting}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
})

export default ProfilePage
