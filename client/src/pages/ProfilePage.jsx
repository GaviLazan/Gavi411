import { useState, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/react'
import './CompleteProfile.css'

// Profile page (G411-80) — lets a friend view their account and update the
// one field Clerk can't manage: phone number (Clerk doesn't support Israeli
// numbers, see G411-69). Everything else Clerk already handles well in its
// own native, well-designed account modal (name, username, email, photo,
// password, connected accounts, sign-out-other-devices) — Gavi's call: we
// don't rebuild any of that, "Update account info" opens Clerk's own UI for
// it. Only phone gets its own small edit flow, right here.
function ProfilePage({ user, onBack, onUpdated }) {
  const { user: clerkUser } = useUser()
  const { openUserProfile } = useClerk()
  const [editingPhone, setEditingPhone] = useState(false)
  const [dialCode, setDialCode] = useState('+972')
  const [localNumber, setLocalNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Real per-country grouping conventions, not guessed — dial code decides
  // which grouping applies. Israel's stored value already has its leading
  // 0 dropped (normalizePhoneNumber's job), so its prefix group is 2
  // digits, not 3 — a bug caught live (Gavi) in an earlier version of this
  // formatter that sliced 3 and produced "+972544-284668" instead of the
  // correct "+972 54-4284668".
  const dialCodeOptions = [
    { code: '+972', country: 'Israel', group: (d) => d.length > 2 ? [d.slice(0, 2), d.slice(2)].join('-') : d },
    { code: '+1', country: 'United States', group: groupNanp },
    { code: '+1', country: 'Canada', group: groupNanp },
    { code: '+44', country: 'United Kingdom', group: (d) => d.length > 4 ? [d.slice(0, 4), d.slice(4)].join(' ') : d },
    { code: '+33', country: 'France', group: (d) => d.match(/.{1,2}/g)?.join(' ') ?? d },
    { code: '+49', country: 'Germany', group: (d) => d.length > 3 ? [d.slice(0, 3), d.slice(3)].join(' ') : d },
    { code: '+61', country: 'Australia', group: (d) => d.match(/.{1,3}/g)?.join(' ') ?? d },
  ]

  // NANP (US/Canada): XXX-XXX-XXXX.
  function groupNanp(d) {
    if (d.length !== 10) return d
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }

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
      setDialCode(knownCode.code)
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
        setDialCode(knownCode.code)
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

  return (
    <div className="complete-profile">
      <h1>Profile</h1>

      <div style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ marginBottom: 'var(--space-1)' }}>
          <strong>Name:</strong> {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || '(not set)'}
        </div>
        <div style={{ marginBottom: 'var(--space-1)' }}>
          <strong>Username:</strong> {user?.username || '(not set)'}
        </div>
        <div style={{ marginBottom: 'var(--space-1)' }}>
          <strong>Email:</strong> {user?.email || '(not set)'}
        </div>
        <div style={{ marginBottom: 'var(--space-1)' }}>
          <strong>Profile picture:</strong>
          {user?.profilePic ? (
            <img src={user.profilePic} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginLeft: 'var(--space-1)' }} />
          ) : (
            <span style={{ marginLeft: 'var(--space-1)' }}>Not set</span>
          )}
        </div>
      </div>

      {!editingPhone ? (
        <>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <strong>Phone:</strong> {formatPhoneNumber(user?.phoneNumber) || '(not set)'}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {/* Name/username/email/photo/password/connected-accounts/
                device-sign-out all live in Clerk's own account modal —
                Gavi's call: no need to duplicate a UI Clerk already does
                well. Only phone (Clerk-unsupported for Israeli numbers)
                gets a custom edit flow, below. */}
            <button type="button" onClick={() => openUserProfile()}>
              Update account info
            </button>
            <button type="button" onClick={startEditingPhone}>
              Update phone number
            </button>
            <button type="button" onClick={onBack}>
              Back
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="phone-section">
            <label>
              Phone number
              <div className="phone-input-group">
                <select
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value)}
                >
                  {dialCodeOptions.map((opt) => (
                    <option key={opt.country} value={opt.code}>
                      {opt.country} ({opt.code})
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={localNumber}
                  onChange={(e) => setLocalNumber(e.target.value)}
                  placeholder={getPlaceholder()}
                />
              </div>
            </label>
          </div>

          {error && <p role="alert">{error}</p>}

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={cancelEditingPhone} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default ProfilePage
