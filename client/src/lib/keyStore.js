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
