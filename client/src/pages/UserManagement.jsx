import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Select from '../components/Select'
import Input from '../components/Input'
import './UserManagement.css'

// Admin user-management screen (G411-99) — consolidated view for managing
// all non-admin users with 4 actions per user:
// 1. Change group tag (calls existing PATCH .../group-tag)
// 2. Adjust credit balance (+/- adjustment)
// 3. Edit basic info (name, phone)
// 4. Block/delete account (toggle block, or soft-delete with confirmation)

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

function UserManagement({ onBack }) {
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
  // ProfilePage.jsx's self-delete (G411-96), not a ConfirmModal (that
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

  if (loading) return <p>Loading users…</p>
  if (error) return <div style={{ color: '#d32f2f' }}><p>Error: {error}</p><Button onClick={onBack}>Back</Button></div>
  if (!users || users.length === 0) return <div><p>No users to manage.</p><Button onClick={onBack}>Back</Button></div>

  return (
    <div className="user-management">
      <h1>User Management</h1>
      {error && <p role="alert" style={{ color: '#d32f2f', marginBottom: 'var(--space-3)' }}>Error: {error}</p>}

      <div className="users-list">
        {users.map((user) => {
          const isEditing = editingUsers[user.clerkId]
          const creditInput = updatingCredit?.userId === user.clerkId ? updatingCredit.input : ''
          const creditDelta = creditInputToDelta(creditInput, user.creditBalance)

          return (
            <Card key={user.clerkId} className="user-card">
              <div className="user-header">
                <div className="user-name">
                  <strong dir="auto">{user.firstName} {user.lastName}</strong>
                  {user.isDeleted && <span className="badge deleted">Deleted</span>}
                  {user.isBlocked && <span className="badge blocked">Blocked</span>}
                </div>
              </div>

              {/* Group Tag */}
              <div className="user-section">
                <label>Group Tag:</label>
                <Select
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

              {/* Credit Balance */}
              <div className="user-section">
                <label>Credits: {user.creditBalance}</label>
                <div className="credit-adjustment">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="new total, or +5 / -2"
                    value={creditInput}
                    onChange={(e) => setUpdatingCredit({ userId: user.clerkId, input: e.target.value })}
                    disabled={user.isDeleted || creditsLoading[user.clerkId]}
                  />
                  <Button
                    onClick={() => handleCreditAdjustment(user.clerkId, creditDelta)}
                    disabled={!creditDelta || creditDelta === 0 || user.isDeleted || creditsLoading[user.clerkId]}
                  >
                    {creditsLoading[user.clerkId] ? '…' : 'Adjust'}
                  </Button>
                </div>
              </div>

              {/* User Info Edit */}
              {isEditing ? (
                <div className="user-section">
                  <div>
                    <label>First Name:</label>
                    <Input
                      value={isEditing.firstName ?? user.firstName}
                      onChange={(e) => setEditingUsers({ ...editingUsers, [user.clerkId]: { ...isEditing, firstName: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label>Last Name:</label>
                    <Input
                      value={isEditing.lastName ?? user.lastName}
                      onChange={(e) => setEditingUsers({ ...editingUsers, [user.clerkId]: { ...isEditing, lastName: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label>Phone:</label>
                    <Input
                      value={isEditing.phoneNumber ?? user.phoneNumber}
                      onChange={(e) => setEditingUsers({ ...editingUsers, [user.clerkId]: { ...isEditing, phoneNumber: e.target.value } })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button
                      onClick={() => handleInfoUpdate(user.clerkId)}
                      disabled={infoLoading[user.clerkId]}
                    >
                      {infoLoading[user.clerkId] ? '…' : 'Save'}
                    </Button>
                    <Button onClick={() => setEditingUsers({ ...editingUsers, [user.clerkId]: null })}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="user-section">
                  <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
                  <p><strong>Phone:</strong> {user.phoneNumber}</p>
                  <Button
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
                    Edit Info
                  </Button>
                </div>
              )}

              {/* Block/Delete Actions */}
              <div className="user-section">
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Button
                    onClick={() => handleBlockToggle(user.clerkId, user.isBlocked)}
                    disabled={user.isDeleted || blockLoading[user.clerkId]}
                    variant={user.isBlocked ? 'secondary' : 'secondary'}
                  >
                    {blockLoading[user.clerkId] ? '…' : user.isBlocked ? 'Unblock' : 'Block'}
                  </Button>
                  {deleteConfirm.open && deleteConfirm.userId === user.clerkId ? null : (
                    <Button
                      onClick={() => startDelete(user)}
                      disabled={user.isDeleted || deleteLoading[user.clerkId]}
                      style={{ color: '#d32f2f' }}
                    >
                      Delete
                    </Button>
                  )}
                </div>

                {/* Inline type-to-confirm expand, same pattern as
                    ProfilePage.jsx's self-delete (G411-96) — not a
                    ConfirmModal, which has no text-input slot. */}
                {deleteConfirm.open && deleteConfirm.userId === user.clerkId && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <p>
                      This will permanently delete {deleteConfirm.userName}'s account. Type
                      their first name to confirm.
                    </p>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Enter first name"
                    />
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                      <Button
                        onClick={handleDeleteUser}
                        disabled={
                          deleteLoading[user.clerkId] ||
                          deleteConfirmText.trim().toLowerCase() !== deleteConfirm.userName.toLowerCase()
                        }
                        style={{ color: '#d32f2f' }}
                      >
                        {deleteLoading[user.clerkId] ? 'Deleting…' : 'Delete account'}
                      </Button>
                      <Button onClick={cancelDelete} disabled={deleteLoading[user.clerkId]}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Button onClick={onBack}>Back</Button>
    </div>
  )
}

export default UserManagement
