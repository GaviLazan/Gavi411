import { useState, useEffect } from 'react'
import { useUser } from '@clerk/react'
import './CompleteProfile.css'

// Profile page (G411-80) — allows friends to view and edit their profile
// at any time (not just on first login). Reachable by clicking the account
// indicator in the header.
function ProfilePage({ user, onBack, onUpdated }) {
  const { user: clerkUser } = useUser()
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [dialCode, setDialCode] = useState('+972')
  const [localNumber, setLocalNumber] = useState('')
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(user?.profilePic ?? null)
  const [photoError, setPhotoError] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Store initial values to detect changes
  const [initialValues, setInitialValues] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    profilePic: user?.profilePic ?? null,
  })

  const dialCodeOptions = [
    { code: '+972', country: 'Israel' },
    { code: '+1', country: 'United States' },
    { code: '+1', country: 'Canada' },
    { code: '+44', country: 'United Kingdom' },
    { code: '+33', country: 'France' },
    { code: '+49', country: 'Germany' },
    { code: '+61', country: 'Australia' },
  ]

  // Parse the stored phone number into dial code and local number on mount.
  // Bug found in review: a greedy `/^(\+\d+)(.*)$/` swallows the whole
  // digit string into the dial-code group, leaving localNumber empty and
  // dialCode matching none of dialCodeOptions — every load showed a blank
  // phone field, and normalizePhoneNumber() would silently prepend
  // whatever got typed with the full original number. Match against the
  // known dial codes instead (longest first, so '+1' doesn't shadow a
  // longer prefix) since that's the only alphabet normalizePhoneNumber()
  // ever writes.
  useEffect(() => {
    if (user?.phoneNumber) {
      const phoneNumber = user.phoneNumber
      const knownCode = [...dialCodeOptions]
        .sort((a, b) => b.code.length - a.code.length)
        .find((opt) => phoneNumber.startsWith(opt.code))
      if (knownCode) {
        setDialCode(knownCode.code)
        setLocalNumber(phoneNumber.slice(knownCode.code.length))
      } else {
        // Fallback for local-only format like '050-1234567'
        setLocalNumber(phoneNumber)
      }
    }
  }, [user?.phoneNumber])

  function getPlaceholder() {
    if (dialCode === '+972') return 'e.g. 050-1234567'
    return 'Phone number'
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError(null)
    setUploadingPhoto(true)
    try {
      // Upload to Clerk and get the image URL
      const imageResource = await clerkUser.setProfileImage({ file })
      if (imageResource.publicUrl) {
        setSelectedPhotoUrl(imageResource.publicUrl)
      } else {
        setPhotoError('Upload succeeded but no photo URL was returned — try again.')
      }
    } catch (err) {
      setPhotoError('Could not upload photo — try again.')
    } finally {
      setUploadingPhoto(false)
    }
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // If phone number is changed, validate it
    const normalizedPhone = normalizePhoneNumber()
    const phoneChanged = normalizedPhone !== initialValues.phoneNumber
    if (phoneChanged && !validatePhoneNumber()) {
      setError('Please enter a valid phone number')
      return
    }

    // Build the update payload with only changed fields
    const updateData = {}
    if (firstName !== initialValues.firstName) updateData.firstName = firstName
    if (lastName !== initialValues.lastName) updateData.lastName = lastName
    if (email !== initialValues.email) updateData.email = email
    if (phoneChanged) updateData.phoneNumber = normalizedPhone
    if (selectedPhotoUrl !== initialValues.profilePic) updateData.profilePic = selectedPhotoUrl

    // If nothing changed, just call onBack
    if (Object.keys(updateData).length === 0) {
      onBack()
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update profile')
      }

      const data = await res.json()
      onUpdated(data.user)
      onBack()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="complete-profile">
      <h1>Edit profile</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            First name
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
        </div>

        <div>
          <label>
            Last name
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
        </div>

        <div>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>

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

        <div className="photo-section">
          <h3>Profile picture</h3>
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
        </div>

        {error && <p role="alert">{error}</p>}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="submit" disabled={submitting || uploadingPhoto}>
            {submitting ? 'Saving…' : uploadingPhoto ? 'Uploading photo…' : 'Save'}
          </button>
          <button type="button" onClick={onBack} disabled={submitting || uploadingPhoto}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProfilePage
