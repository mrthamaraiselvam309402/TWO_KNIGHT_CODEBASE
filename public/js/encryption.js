/**
 * Field-Level Encryption Module for PII
 * Uses Web Crypto API for AES-GCM encryption
 */

const ENCRYPTION_KEY_NAME = 'ck-encryption-key';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

// Fields that should be encrypted
const SENSITIVE_FIELDS = [
  'parent_phone',
  'phone', 
  'email',
  'address'
];

/**
 * Generate or retrieve encryption key from IndexedDB
 */
async function getEncryptionKey() {
  try {
    // Try to get existing key from localStorage (base64 encoded)
    let keyStr = localStorage.getItem(ENCRYPTION_KEY_NAME);
    
    if (!keyStr) {
      // Generate new key
      const key = await crypto.subtle.generateKey(
        { name: ALGORITHM, length: KEY_LENGTH },
        true, // extractable
        ['encrypt', 'decrypt']
      );
      
      // Export as base64
      const exported = await crypto.subtle.exportKey('raw', key);
      keyStr = btoa(String.fromCharCode(...new Uint8Array(exported)));
      localStorage.setItem(ENCRYPTION_KEY_NAME, keyStr);
    }
    
    // Import key
    const rawKey = Uint8Array.from(atob(keyStr), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.warn('Encryption key error:', error);
    return null;
  }
}

/**
 * Encrypt a plaintext string
 */
async function encryptField(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  
  try {
    const key = await getEncryptionKey();
    if (!key) return plaintext;
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoded
    );
    
    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.warn('Encryption failed:', error);
    return plaintext;
  }
}

/**
 * Decrypt a ciphertext string
 */
async function decryptField(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  
  try {
    const key = await getEncryptionKey();
    if (!key) return ciphertext;
    
    // Decode base64
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.warn('Decryption failed:', error);
    return ciphertext;
  }
}

/**
 * Check if a value looks like encrypted data
 */
function isEncrypted(value) {
  if (typeof value !== 'string') return false;
  // Encrypted values are base64 and typically longer
  try {
    atob(value);
    return value.length > 20;
  } catch {
    return false;
  }
}

/**
 * Encrypt payment data object
 */
async function encryptPaymentData(payment) {
  if (!payment || typeof payment !== 'object') return payment;
  
  const encrypted = { ...payment };
  if (payment.transaction_id && payment.transaction_id.length < 32) {
    encrypted.transaction_id = await encryptField(payment.transaction_id);
  }
  return encrypted;
}

/**
 * Initialize encryption module
 */
async function initEncryption() {
  try {
    await getEncryptionKey();
    console.log('[Encryption] Module initialized');
  } catch (error) {
    console.warn('[Encryption] Initialization failed:', error);
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  initEncryption();
}
