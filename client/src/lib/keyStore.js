// IndexedDB storage for local private key and device id.
// Browser-only, untested by design. Stores CryptoKey (non-extractable) directly.

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

// Shared IndexedDB put/get for CryptoKey and device id (different keys, same store).
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

// Device id: saved after linking request, needed for approval checks.
export const saveDeviceId = (id) => putValue(DEVICE_ID_KEY, id)
export const loadDeviceId = () => getValue(DEVICE_ID_KEY)
