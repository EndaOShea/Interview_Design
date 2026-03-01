/**
 * Client-side encryption for API keys using AES-GCM via the Web Crypto API.
 *
 * The AES-256 key is generated once, stored as a non-extractable CryptoKey
 * object in IndexedDB, and never written to localStorage. "Non-extractable"
 * means the raw key bytes are inaccessible to JavaScript — even from DevTools.
 *
 * Encrypted values stored in localStorage are: base64(IV[12 bytes] + ciphertext).
 * An attacker who copies localStorage gets ciphertext they cannot decrypt without
 * the IndexedDB key, which is bound to the browser origin.
 *
 * Downside: clearing browser storage (IndexedDB + localStorage together) destroys
 * the key, making stored API keys unreadable. Users would need to re-enter them.
 * This is the correct security behaviour.
 */

const DB_NAME = 'architectai-crypto';
const STORE_NAME = 'keys';
const KEY_ID = 'aes-gcm-key';
const AI_CONFIG_KEY = 'ai_config';

let _key: CryptoKey | null = null;

// --- IndexedDB helpers ---

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, id: string): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, id: string, value: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Key management ---

async function getKey(): Promise<CryptoKey> {
  if (_key) return _key;

  const db = await openDb();
  const existing = await idbGet(db, KEY_ID);

  if (existing) {
    _key = existing;
    return _key;
  }

  // Generate a non-extractable AES-GCM key — raw bytes are never accessible to JS
  _key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: cannot be exported or read
    ['encrypt', 'decrypt']
  );

  await idbPut(db, KEY_ID, _key);
  return _key;
}

// --- Public API ---

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function encryptApiKey(key: string): Promise<string> {
  if (!key) return '';
  try {
    const cryptoKey = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(key);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
    const combined = new Uint8Array(12 + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), 12);
    return uint8ToBase64(combined);
  } catch (e) {
    console.error('Encryption failed:', e);
    return '';
  }
}

export async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted) return '';
  try {
    const cryptoKey = await getKey();
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    // Fall back to legacy XOR format (for values stored before the AES upgrade)
    return xorDecrypt(encrypted);
  }
}

// --- Legacy XOR fallback (read-only, used only during migration) ---

function xorDecrypt(encrypted: string): string {
  return xorDecryptWithSalt(encrypted, 'architectai-v2-secure')
    || xorDecryptWithSalt(encrypted, 'architectai-v1')
    || '';
}

function xorDecryptWithSalt(encrypted: string, salt: string): string {
  try {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
    }
    const combined = atob(result);
    const parts = combined.split('::');
    if (parts.length < 2) return '';
    const key = parts.slice(0, -1).join('::');
    if (parts[parts.length - 1] !== salt) return '';
    return key;
  } catch {
    return '';
  }
}

// --- Initialization ---

/** Pre-loads (or generates) the AES key so the first encrypt/decrypt is instant. */
export async function initCrypto(): Promise<void> {
  // Remove the old localStorage key from the previous (insecure) implementation
  localStorage.removeItem('architectai-aes-key');
  await getKey();
}

/**
 * Finds any XOR-obfuscated API keys in ai_config and re-encrypts them with
 * AES-GCM. Called once at app startup, after initCrypto().
 */
export async function migrateToSecureEncryption(): Promise<boolean> {
  try {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    if (!stored) return false;

    const config = JSON.parse(stored);
    if (!config?.apiKeys) return false;

    const cryptoKey = await getKey();
    let migrated = false;

    for (const provider of ['gemini', 'openai', 'claude'] as const) {
      const value: string | undefined = config.apiKeys[provider];
      if (!value) continue;

      // Test if already AES-GCM encrypted with the current key
      let alreadyAes = false;
      try {
        const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: bytes.slice(0, 12) },
          cryptoKey,
          bytes.slice(12)
        );
        alreadyAes = true;
      } catch { /* not AES-encrypted */ }

      if (alreadyAes) continue;

      // XOR-decrypt the old value and re-encrypt with AES-GCM
      const plaintext = xorDecrypt(value);
      if (plaintext) {
        config.apiKeys[provider] = await encryptApiKey(plaintext);
        migrated = true;
      }
    }

    if (migrated) {
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      console.log('Migrated API keys to AES-GCM encryption');
    }
    return migrated;
  } catch (e) {
    console.error('AES migration failed:', e);
    return false;
  }
}

// --- Config helpers (kept for compatibility) ---

export function encryptConfig(config: object): string {
  try {
    return btoa(JSON.stringify(config));
  } catch (e) {
    console.error('Config encryption failed:', e);
    return '';
  }
}

export function decryptConfig(encrypted: string): object | null {
  try {
    return JSON.parse(atob(encrypted));
  } catch (e) {
    console.error('Config decryption failed:', e);
    return null;
  }
}
