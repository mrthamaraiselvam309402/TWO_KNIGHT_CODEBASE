/**
 * Field-Level Encryption Module for PII
 * Uses Web Crypto API for AES-GCM encryption
 */

const ENCRYPTION_KEY_NAME = 'ck-encryption-key'
const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256

// Fields that should be encrypted
const SENSITIVE_FIELDS = [
  'parent_phone',
  'phone',
  'email',
  'address'
]

/**
 * Derive encryption key from a stable source
 */
async function deriveKeyFromSource(source) {
  const encoder = new TextEncoder()
  const data = encoder.encode(source)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return await crypto.subtle.importKey(
    'raw',
    new Uint8Array(hash.slice(0, 32)),
    { name: ALGORITHM },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Generate or retrieve encryption key from localStorage
 */
/**
 * Base64 helpers that work safely with raw binary bytes
 */
function uint8ArrayToBase64(value) {
  const binary = Array.from(value, byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

function base64ToUint8Array(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, byte => byte.charCodeAt(0));
}

async function getEncryptionKey() {
  try {
    let keyStr = localStorage.getItem(ENCRYPTION_KEY_NAME)

    if (!keyStr) {
      const encoder = new TextEncoder()
      const data = encoder.encode('twoknights-encryption-v1')
      const hash = await crypto.subtle.digest('SHA-256', data)
      keyStr = uint8ArrayToBase64(new Uint8Array(hash))
      localStorage.setItem(ENCRYPTION_KEY_NAME, keyStr)
    }

    const rawKey = base64ToUint8Array(keyStr)
    return await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: ALGORITHM },
      true,
      ['encrypt', 'decrypt']
    )
  } catch (error) {
    console.warn('Encryption key error:', error)
    return null
  }
}

/**
 * Encrypt a plaintext string
 */
async function encryptField(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext

  try {
    const key = await getEncryptionKey()
    if (!key) return plaintext

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoded
    )

    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)

    return uint8ArrayToBase64(combined)
  } catch (error) {
    console.warn('Encryption failed:', error)
    return plaintext
  }
}

/**
 * Decrypt a ciphertext string
 */
async function decryptField(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext

  try {
    const key = await getEncryptionKey()
    if (!key) return ciphertext

    const combined = base64ToUint8Array(ciphertext)
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    )

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.warn('Decryption failed:', error)
    return ciphertext
  }
}

/**
 * Check if a value looks like encrypted data
 */
function isEncrypted(value) {
  if (typeof value !== 'string') return false
  try {
    atob(value)
    return value.length > 20
  } catch {
    return false
  }
}

/**
 * Encrypt payment data object
 */
async function encryptPaymentData(payment) {
  if (!payment || typeof payment !== 'object') return payment

  const encrypted = { ...payment }
  if (payment.transaction_id && payment.transaction_id.length < 32) {
    encrypted.transaction_id = await encryptField(payment.transaction_id)
  }
  return encrypted
}

/**
 * Initialize encryption module
 */
async function initEncryption() {
  try {
    await getEncryptionKey()
    console.log('[Encryption] Module initialized')
  } catch (error) {
    console.warn('[Encryption] Initialization failed:', error)
  }
}

// On page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (typeof toast === 'function') {
        toast('Encryption module ready. Data will be encrypted in your browser.', 'info', 5000)
      }
    }, 2000)
  })
  initEncryption()
}