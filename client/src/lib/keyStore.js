// IndexedDB storage for the local private key (G411-28 stage 1) and, since
// device-linking (2026-09-01), this device's own server-side Device.id.
// Browser-only (no jsdom test env in this repo yet — same reasoning
// useTheme.js documents), so this is a thin wrapper kept untested by
// design; the crypto logic it stores/retrieves is covered by
// crypto.test.js instead.
//
// One keypair per browser/device, non-extractable private key (see
// crypto.js's generateKeypair) — IndexedDB holds a CryptoKey object
// directly, not raw bytes, so even DB access can't read out the key.

const DB_NAME = 'gavi411-keys'
const STORE_NAME = 'keypair'
const KEY_ID = 'device-keypair'
const DEVICE_ID_KEY = 'device-id'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Shared put/get — savePrivateKey/loadPrivateKey and saveDeviceId/
// loadDeviceId used to each hand-roll this same open/transaction/resolve/
// reject shape (Sibling review finding, G411-28 PR #35). IndexedDB
// doesn't care about value shape, so a CryptoKey and a plain number share
// the one object store, keyed differently.
async function putValue(key, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getValue(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export const savePrivateKey = (privateKey) => putValue(KEY_ID, privateKey)
export const loadPrivateKey = () => getValue(KEY_ID)

// Device-linking (G411-28, 2026-09-01). This device's own `Device.id` row
// on the server, once it's requested linking — needed to later ask
// GET /api/devices/my-keys "have I been approved, and what's mine to
// unwrap."
export const saveDeviceId = (id) => putValue(DEVICE_ID_KEY, id)
export const loadDeviceId = () => getValue(DEVICE_ID_KEY)
