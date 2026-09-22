import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Select from '../components/Select'
import Input from '../components/Input'
import './UserManagement.css'

// Admin user-management screen — consolidated view for managing
// all non-admin users with 4 actions per user:
// 1. Change group tag (calls existing PATCH .../group-tag)
// 2. Adjust credit balance (+/- adjustment)
// 3. Edit basic info (name, phone)
// 4. Block/delete account (toggle block, or soft-delete with confirmation)
//
// bar's own chevron already covers every non-'list' view.

// Gavi's call: the input reads as "set balance to this number" by
// default (matches how admin actually thinks about it), but a leading
// +/- still means "adjust by this much" — the server only ever wants a
// delta, so this converts a plain target into one against the user's
// current balance.
export function creditInputToDelta(input, currentBalance) {
  const trimmed = input.trim()
  if (!trimmed) return 0
  const isExplicitDelta = trimmed.startsWith('+') || trimmed.startsWith('-')
  const parsed = parseInt(trimmed, 10)
  if (Number.isNaN(parsed)) return 0
  return isExplicitDelta ? parsed : parsed - currentBalance
}

function UserManagement() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Per-user edit state: { [clerkId]: { editing, firstName, lastName, phoneNumber } }
  const [editingUsers, setEditingUsers] = useState({})
  const [updatingCredit, setUpdatingCredit] = useState(null) // { userId, input: raw text }
  const [creditsLoading, setCreditsLoading] = useState({}) // { userId: boolean }
  const [infoLoading, setInfoLoading] = useState({}) // { userId: boolean }
  const [blockLoading, setBlockLoading] = useState({}) // { userId: boolean }
  const [deleteLoading, setDeleteLoading] = useState({}) // { userId: boolean }

  // Delete confirmation — inline type-to-confirm expand, same pattern as
  // ProfilePage.jsx's self-delete, not a ConfirmModal (that
  // component only supports a plain message + Yes/No, no text-input slot —
  // the prior version here silently could never pass its own confirm check).
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, userId: null, userName: '' })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Fetch all users on mount
  useEffect(() => {
    async function loadUsers() {
      setError('')
      setLoading(true)
      try {
        const res = await fetch('/api/requests/users')
        if (!res.ok) throw new Error('Failed to load users')
        const data = await res.json()
        setUsers(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadUsers()
  }, [])

  async function handleGroupTagChange(userId, newTag) {
    try {
      const res = await fetch(`/api/requests/users/${userId}/group-tag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupTag: newTag }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update group tag')
      }
      const updated = await res.json()
      // Update the local user in the list
      setUsers(users.map(u => u.clerkId === userId ? { ...u, groupTag: updated.groupTag, creditBalance: updated.creditBalance } : u))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreditAdjustment(userId, delta) {
    if (!delta || delta === 0) return
    setCreditsLoading({ ...creditsLoading, [userId]: true })
    try {
      const res = await fetch(`/api/requests/users/${userId}/credit-adjustment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to adjust credits')
      }
      const updated = await res.json()
      setUsers(users.map(u => u.clerkId === userId ? { ...u, creditBalance: updated.creditBalance } : u))
      setUpdatingCredit(null) // Clear the input
    } catch (err) {
      setError(err.message)
    } finally {
      setCreditsLoading({ ...creditsLoading, [userId]: false })
    }
  }

  async function handleInfoUpdate(userId) {
    const edits = editingUsers[userId]
    if (!edits) return

    setInfoLoading({ ...infoLoading, [userId]: true })
    try {
      const body = {}
      if (edits.firstName !== undefined) body.firstName = edits.firstName
      if (edits.lastName !== undefined) body.lastName = edits.lastName
      if (edits.phoneNumber !== undefined) body.phoneNumber = edits.phoneNumber

      const res = await fetch(`/api/requests/users/${userId}/info`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update user info')
      }
      const updated = await res.json()
      setUsers(users.map(u =>
        u.clerkId === userId
          ? { ...u, firstName: updated.firstName, lastName: updated.lastName, phoneNumber: updated.phoneNumber }
          : u
      ))
      setEditingUsers({ ...editingUsers, [userId]: null })
    } catch (err) {
      setError(err.message)
    } finally {
      setInfoLoading({ ...infoLoading, [userId]: false })
    }
  }

  async function handleBlockToggle(userId, currentBlocked) {
    setBlockLoading({ ...blockLoading, [userId]: true })
    try {
      const res = await fetch(`/api/requests/users/${userId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !currentBlocked }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update block status')
      }
      const updated = await res.json()
      setUsers(users.map(u => u.clerkId === userId ? { ...u, isBlocked: updated.isBlocked } : u))
    } catch (err) {
      setError(err.message)
    } finally {
      setBlockLoading({ ...blockLoading, [userId]: false })
    }
  }

  async function handleDeleteUser() {
    const { userId } = deleteConfirm
    setDeleteLoading({ ...deleteLoading, [userId]: true })
    try {
      const res = await fetch(`/api/requests/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete user')
      }
      // Remove from list after successful delete
      setUsers(users.filter(u => u.clerkId !== userId))
      setDeleteConfirm({ open: false, userId: null, userName: '' })
      setDeleteConfirmText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteLoading({ ...deleteLoading, [userId]: false })
    }
  }

  function startDelete(user) {
    setDeleteConfirm({ open: true, userId: user.clerkId, userName: user.firstName })
    setDeleteConfirmText('')
  }

  function cancelDelete() {
    setDeleteConfirm({ open: false, userId: null, userName: '' })
    setDeleteConfirmText('')
  }

  if (loading) {
    return (
      <div className="user-management">
        <Card>Loading users…</Card>
      </div>
    )
  }

  if (error && !users) {
    return (
      <div className="user-management">
        <Card><p role="alert" className="user-management-error">Error: {error}</p></Card>
      </div>
    )
  }

  if (!users || users.length === 0) {
    return (
      <div className="user-management">
        <Card>No users to manage.</Card>
      </div>
    )
  }

  return (
    <div className="user-management">
      <h2>User management</h2>
      {error && <p role="alert" className="user-management-error">{error}</p>}

      <div className="users-list">
        {users.map((user) => {
          const isEditing = editingUsers[user.clerkId]
          const creditInput = updatingCredit?.userId === user.clerkId ? updatingCredit.input : ''
          const creditDelta = creditInputToDelta(creditInput, user.creditBalance)
          const isDeleting = deleteConfirm.open && deleteConfirm.userId === user.clerkId

          return (
            <Card key={user.clerkId} className="user-card">
              <div className="user-header">
                <strong className="user-name" dir="auto">{user.firstName} {user.lastName}</strong>
                {user.isDeleted && <span className="user-badge user-badge-deleted">Deleted</span>}
                {user.isBlocked && <span className="user-badge user-badge-blocked">Blocked</span>}
              </div>

              <div className="user-section">
                <Select
                  id={`user-group-tag-${user.clerkId}`}
                  label="Group tag"
                  value={user.groupTag}
                  onChange={(e) => handleGroupTagChange(user.clerkId, e.target.value)}
                  disabled={user.isDeleted}
                  options={[
                    { value: 'LIMITED', label: 'Limited (2 credits)' },
                    { value: 'REGULAR', label: 'Regular (5 credits)' },
                    { value: 'CLOSE', label: 'Close (7 credits)' },
                  ]}
                />
              </div>

              <div className="user-section">
                <span className="field-label">Credits: {user.creditBalance}</span>
                <div className="user-credit-row">
                  <Input
                    id={`user-credit-${user.clerkId}`}
                    type="text"
                    inputMode="numeric"
                    placeholder="new total, or +5 / -2"
                    value={creditInput}
                    onChange={(e) => setUpdatingCredit({ userId: user.clerkId, input: e.target.value })}
                    disabled={user.isDeleted || creditsLoading[user.clerkId]}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleCreditAdjustment(user.clerkId, creditDelta)}
                    disabled={!creditDelta || creditDelta === 0 || user.isDeleted || creditsLoading[user.clerkId]}
                  >
                    {creditsLoading[user.clerkId] ? '…' : 'Adjust'}
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <div className="user-section user-info-form">
                  <Input
                    id={`user-first-name-${user.clerkId}`}
                    label="First name"
                    value={isEditing.firstName ?? user.firstName}
                    onChange={(e) => setEditingUsers({ ...editingUsers, [user.clerkId]: { ...isEditing, firstName: e.target.value } })}
                  />
                  <Input
                    id={`user-last-name-${user.clerkId}`}
                    label="Last name"
                    value={isEditing.lastName ?? user.lastName}
                    onChange={(e) => setEditingUsers({ ...editingUsers, [user.clerkId]: { ...isEditing, lastName: e.target.value } })}
                  />
                  <Input
                    id={`user-phone-${user.clerkId}`}
                    label="Phone"
                    value={isEditing.phoneNumber ?? user.phoneNumber}
                    onChange={(e) => setEditingUsers({ ...editingUsers, [user.clerkId]: { ...isEditing, phoneNumber: e.target.value } })}
                  />
                  <div className="user-actions">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handleInfoUpdate(user.clerkId)}
                      disabled={infoLoading[user.clerkId]}
                    >
                      {infoLoading[user.clerkId] ? '…' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditingUsers({ ...editingUsers, [user.clerkId]: null })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="user-section">
                  <p className="meta" dir="auto">{user.phoneNumber}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditingUsers({
                      ...editingUsers,
                      [user.clerkId]: {
                        firstName: user.firstName,
                        lastName: user.lastName,
                        phoneNumber: user.phoneNumber,
                      },
                    })}
                    disabled={user.isDeleted}
                  >
                    Edit info
                  </Button>
                </div>
              )}

              <div className="user-section user-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleBlockToggle(user.clerkId, user.isBlocked)}
                  disabled={user.isDeleted || blockLoading[user.clerkId]}
                >
                  {blockLoading[user.clerkId] ? '…' : user.isBlocked ? 'Unblock' : 'Block'}
                </Button>
                {!isDeleting && (
                  <Button
                    type="button"
                    variant="danger-text"
                    onClick={() => startDelete(user)}
                    disabled={user.isDeleted || deleteLoading[user.clerkId]}
                  >
                    Delete
                  </Button>
                )}
              </div>

              {/* Inline type-to-confirm expand, same pattern as
                  ProfilePage.jsx's self-delete — not a
                  ConfirmModal, which has no text-input slot. */}
              {isDeleting && (
                <div className="user-section user-delete-confirm">
                  <p>
                    This will permanently delete {deleteConfirm.userName}'s account. Type
                    their first name to confirm.
                  </p>
                  <Input
                    id={`user-delete-confirm-${user.clerkId}`}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Enter first name"
                  />
                  <div className="user-actions">
                    <Button
                      type="button"
                      variant="danger-primary"
                      onClick={handleDeleteUser}
                      disabled={
                        deleteLoading[user.clerkId] ||
                        deleteConfirmText.trim().toLowerCase() !== deleteConfirm.userName.toLowerCase()
                      }
                    >
                      {deleteLoading[user.clerkId] ? 'Deleting…' : 'Delete account'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={cancelDelete} disabled={deleteLoading[user.clerkId]}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default UserManagement
