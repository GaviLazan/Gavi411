import { useState, useRef } from 'react'
import { useUser } from '@clerk/react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import './CompleteProfile.css'

// Complete profile — mandatory first-login gate (G411-69). Collects phone
// number (required, unique) and optional profile photo. No onBack prop — this
// is a hard gate, there's nowhere to go back to until phone is set.
//
// G411-112: onto the design system. No Gavi avatar / explanatory copy line
// here (2026-09-20 correction, Gavi's call — the avatar concept was already
// replaced app-wide by a presence dot as of G411-109, and friends already
// know who Gavi is without a line explaining it).
function CompleteProfile({ currentProfilePic, onComplete }) {
  const { user } = useUser()
  const fileInputRef = useRef(null)
  // Holds the option's own id (unique even when two options share a
  // calling code, e.g. US/CA both +1) — the Select needs a value that's
  // actually unique per option; the calling code itself is derived via
  // dialCodeOptions.find() wherever needed, see `dialCode` below.
  const [dialCodeId, setDialCodeId] = useState('IL') // Israel default
  const [localNumber, setLocalNumber] = useState('')
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(currentProfilePic || null)
  const [photoError, setPhotoError] = useState(null)
  // Sibling review finding: the submit button was only disabled by
  // `submitting`, not by an in-flight photo upload — clicking Continue
  // while a Clerk upload was still pending submitted before
  // selectedPhotoUrl updated, silently dropping the photo with no error.
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const dialCodeOptions = [
    { id: 'IL', code: '+972', country: 'Israel' },
    { id: 'US', code: '+1', country: 'United States' },
    { id: 'CA', code: '+1', country: 'Canada' },
    { id: 'GB', code: '+44', country: 'United Kingdom' },
    { id: 'FR', code: '+33', country: 'France' },
    { id: 'DE', code: '+49', country: 'Germany' },
    { id: 'AU', code: '+61', country: 'Australia' },
  ]

  const dialCode = dialCodeOptions.find((opt) => opt.id === dialCodeId)?.code ?? '+972'

  // Determine placeholder text based on selected country
  const getPlaceholder = () => {
    if (dialCode === '+972') return 'e.g. 050-1234567'
    return 'Phone number'
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError(null)
    setUploadingPhoto(true)
    try {
      // Upload to Clerk and get the image URL. Sibling review finding:
      // ImageResource's real field is `publicUrl`, not `url` — the
      // original draft read a field that doesn't exist, so the photo
      // would upload to Clerk successfully but silently never get saved
      // to our own profilePic (submitting `profilePic: undefined` just
      // gets dropped by the PATCH's own spread-if-present logic).
      // publicUrl is typed nullable by Clerk itself — guard it so a rare
      // null doesn't silently overwrite an existing photo with nothing.
      const imageResource = await user.setProfileImage({ file })
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
      <Card>
        <h2>Complete your profile</h2>

        <form onSubmit={handleSubmit} className="complete-profile-form">
          <div className="complete-profile-phone-row">
            <Select
              id="complete-profile-dial-code"
              label="Phone number"
              options={dialCodeOptions.map((opt) => ({ value: opt.id, label: `${opt.country} (${opt.code})` }))}
              value={dialCodeId}
              onChange={(e) => setDialCodeId(e.target.value)}
            />
            <Input
              id="complete-profile-local-number"
              type="tel"
              value={localNumber}
              onChange={(e) => setLocalNumber(e.target.value)}
              placeholder={getPlaceholder()}
              required
            />
          </div>

          <div className="complete-profile-photo-section">
            {selectedPhotoUrl && (
              <img src={selectedPhotoUrl} alt="" className="complete-profile-photo-preview" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="complete-profile-photo-input"
            />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {selectedPhotoUrl ? 'Change photo' : 'Choose photo (optional)'}
            </Button>
            {photoError && <p role="alert" className="complete-profile-error">{photoError}</p>}
            {/* No separate "Skip" control needed — profilePic is only ever
                sent if selectedPhotoUrl is set, so simply not choosing a
                photo already skips this step. A button with no effect of
                its own would be misleading UI (Sibling review finding). */}
          </div>

          {error && <p role="alert" className="complete-profile-error">{error}</p>}

          <Button type="submit" variant="primary" disabled={submitting || uploadingPhoto}>
            {submitting ? 'Continuing…' : uploadingPhoto ? 'Uploading photo…' : 'Continue'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default CompleteProfile
