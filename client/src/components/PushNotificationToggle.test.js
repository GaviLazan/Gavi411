// Tests for push notification toggle's view-state and error-outcome logic.
// Exercises exported pure decision functions (not JSX rendering).

import { describe, it, expect } from 'vitest'
import { pushToggleViewState, pushToggleErrorOutcome } from './PushNotificationToggle'

describe('pushToggleViewState', () => {
  it('hides the item when push is not supported', () => {
    expect(pushToggleViewState(false, 'default', false)).toEqual({ visible: false })
  })

  it('hides the item while support is still being checked (null)', () => {
    expect(pushToggleViewState(null, 'default', false)).toEqual({ visible: false })
  })

  it('shows the denied message when permission is denied', () => {
    expect(pushToggleViewState(true, 'denied', false)).toEqual({ visible: true, denied: true })
  })

  it('shows "Enable notifications" when supported, not denied, not subscribed', () => {
    expect(pushToggleViewState(true, 'default', false)).toEqual({
      visible: true,
      denied: false,
      label: 'Enable notifications',
    })
  })

  it('shows "Enable notifications" when permission already granted but not subscribed', () => {
    expect(pushToggleViewState(true, 'granted', false)).toEqual({
      visible: true,
      denied: false,
      label: 'Enable notifications',
    })
  })

  it('shows "Disable notifications" when subscribed', () => {
    expect(pushToggleViewState(true, 'granted', true)).toEqual({
      visible: true,
      denied: false,
      label: 'Disable notifications',
    })
  })
})

describe('pushToggleErrorOutcome', () => {
  it('treats a subscribe failure as "became denied" when the live permission is denied', () => {
    expect(pushToggleErrorOutcome('denied', 'User denied permission to use the Push API.')).toEqual({
      becameDenied: true,
    })
  })

  it('shows the real error message for a failure unrelated to permission', () => {
    expect(pushToggleErrorOutcome('granted', 'Network error')).toEqual({
      becameDenied: false,
      error: 'Network error',
    })
  })

  it('falls back to a generic message when the error has none', () => {
    expect(pushToggleErrorOutcome('default', undefined)).toEqual({
      becameDenied: false,
      error: 'Failed to update notifications',
    })
  })
})
