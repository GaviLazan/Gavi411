import { useEffect, useState } from 'react'
import { useUser } from '@clerk/react'
import './CompleteProfile.css'

// Complete profile — mandatory first-login gate (G411-69). Collects phone
// number (required, unique) and optional profile photo. No onBack prop — this
// is a hard gate, there's nowhere to go back to until phone is set.
function CompleteProfile({ currentProfilePic, onComplete }) {
  const { user } = useUser()
  const [dialCode, setDialCode] = useState('+972') // Israel default
  const [localNumber, setLocalNumber] = useState('')
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(currentProfilePic || null)
  const [photoError, setPhotoError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const dialCodeOptions = [
    { code: '+972', country: 'Israel' },
    { code: '+1', country: 'United States/Canada' },
    { code: '+44', country: 'United Kingdom' },
    { code: '+33', country: 'France' },
    { code: '+49', country: 'Germany' },
    { code: '+61', country: 'Australia' },
  ]

  // Determine placeholder text based on selected country
  const getPlaceholder = () => {
    if (dialCode === '+972') return 'e.g. 050-1234567'
    return 'Phone number'
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError(null)
    try {
      // Upload to Clerk and get the image URL. Sibling review finding:
      // ImageResource's real field is `publicUrl`, not `url` — the
      // original draft read a field that doesn't exist, so the photo
      // would upload to Clerk successfully but silently never get saved
      // to our own profilePic (submitting `profilePic: undefined` just
      // gets dropped by the PATCH's own spread-if-present logic).
      const imageResource = await user.setProfileImage({ file })
      setSelectedPhotoUrl(imageResource.publicUrl)
    } catch (err) {
      setPhotoError('Could not upload photo — try again.')
    }
  }

  function validatePhoneNumber() {
    // Strip all non-digit characters
    const digitsOnly = localNumber.replace(/\D/g, '')
    // Combine with dial code (removing the + prefix for digit count)
    const dialCodeDigits = dialCode.replace(/\D/g, '')
    const totalDigits = (dialCodeDigits + digitsOnly).length
    // Must be 8-15 total digits
    return totalDigits >= 8 && totalDigits <= 15
  }

  function normalizePhoneNumber() {
    // Strip non-digits from local number
    const digitsOnly = localNumber.replace(/\D/g, '')
    // Remove leading 0 if present (common for Israeli local numbers)
    const withoutLeadingZero = digitsOnly.startsWith('0')
      ? digitsOnly.slice(1)
      : digitsOnly
    // Prepend dial code with +
    return dialCode + withoutLeadingZero
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!validatePhoneNumber()) {
      setError('Please enter a valid phone number')
      return
    }

    setSubmitting(true)
    try {
      const normalizedPhone = normalizePhoneNumber()
      const body = {
        phoneNumber: normalizedPhone,
        ...(selectedPhotoUrl ? { profilePic: selectedPhotoUrl } : {}),
      }

      const res = await fetch('/api/me/complete-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to complete profile')
      }

      // Success — call the onComplete callback to re-fetch and proceed
      onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="complete-profile">
      <h1>Complete your profile</h1>

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
                  <option key={opt.code} value={opt.code}>
                    {opt.country} ({opt.code})
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value)}
                placeholder={getPlaceholder()}
                required
              />
            </div>
          </label>
        </div>

        <div className="photo-section">
          <h3>Profile picture (optional)</h3>
          {selectedPhotoUrl ? (
            <img src={selectedPhotoUrl} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <p>No photo set</p>
          )}
          <label>
            Choose photo
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          </label>
          {photoError && <p role="alert">{photoError}</p>}
          {/* No separate "Skip" control needed — profilePic is only ever
              sent if selectedPhotoUrl is set, so simply not choosing a
              photo already skips this step. A button with no effect of
              its own would be misleading UI (Sibling review finding). */}
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Continuing…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

export default CompleteProfile
