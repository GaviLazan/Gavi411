// IndexedDB storage for the local private key (G411-28 stage 1). Browser-
// only (no jsdom test env in this repo yet — same reasoning useTheme.js
// documents), so this is a thin wrapper kept untested by design; the
// crypto logic it stores/retrieves is covered by crypto.test.js instead.
//
// One keypair per browser/device, non-extractable private key (see
// crypto.js's generateKeypair) — IndexedDB holds a CryptoKey object
// directly, not raw bytes, so even DB access can't read out the key.

const DB_NAME = 'gavi411-keys'
const STORE_NAME = 'keypair'
const KEY_ID = 'device-keypair'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function savePrivateKey(privateKey) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(privateKey, KEY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadPrivateKey() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(KEY_ID)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

// Device-linking (G411-28, 2026-09-01). This device's own `Device.id` row
// on the server, once it's requested linking — needed to later ask
// GET /api/devices/my-keys "have I been approved, and what's mine to
// unwrap." Plain number, not a CryptoKey, so it shares the object store
// (IndexedDB doesn't care about value shape) rather than needing its own
// store/db version bump.
const DEVICE_ID_KEY = 'device-id'

export async function saveDeviceId(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(id, DEVICE_ID_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadDeviceId() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(DEVICE_ID_KEY)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}
