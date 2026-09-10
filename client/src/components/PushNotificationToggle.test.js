// Tests for the push notification toggle's view-state logic (G411-49).
// Exercises the real exported pushToggleViewState function (not a
// duplicated copy of it) — this codebase has no @testing-library/react to
// render the JSX itself, so the pure decision logic is what's covered,
// same convention as this repo's other .test.js files.

import { describe, it, expect } from 'vitest'
import { pushToggleViewState } from './PushNotificationToggle'

describe('pushToggleViewState (G411-49)', () => {
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
