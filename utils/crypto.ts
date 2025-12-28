/**
 * Client-side encryption for API keys
 * Uses a simple but effective XOR-based obfuscation that works synchronously
 * For client-side storage, this provides reasonable protection against casual inspection
 */

const SALT = 'architectai-v2-secure';

/**
 * Encrypt an API key using XOR cipher with salt
 * Returns a base64 encoded string
 */
export function encryptApiKey(key: string): string {
  if (!key) return '';

  try {
    // Combine key with salt
    const combined = key + '::' + SALT;
    const encoded = btoa(combined);

    // XOR obfuscation
    let result = '';
    for (let i = 0; i < encoded.length; i++) {
      const charCode = encoded.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
      result += String.fromCharCode(charCode);
    }

    return btoa(result);
  } catch (e) {
    console.error('Encryption failed:', e);
    return '';
  }
}

/**
 * Decrypt an API key
 */
export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return '';

  // Try current format first
  const currentResult = decryptWithSalt(encrypted, SALT);
  if (currentResult) return currentResult;

  // Try legacy format for backward compatibility
  const legacyResult = decryptWithSalt(encrypted, 'architectai-v1');
  if (legacyResult) return legacyResult;

  return '';
}

/**
 * Decrypt with a specific salt
 */
function decryptWithSalt(encrypted: string, salt: string): string {
  try {
    // Reverse base64
    const decoded = atob(encrypted);

    // Reverse XOR
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
      result += String.fromCharCode(charCode);
    }

    // Decode and extract key
    const combined = atob(result);
    const parts = combined.split('::');

    if (parts.length < 2) return '';

    const key = parts.slice(0, -1).join('::'); // Handle keys that might contain ::
    const extractedSalt = parts[parts.length - 1];

    if (extractedSalt !== salt) {
      return '';
    }

    return key;
  } catch (e) {
    return '';
  }
}

/**
 * Encrypt a config object (for future use)
 */
export function encryptConfig(config: object): string {
  try {
    return btoa(JSON.stringify(config));
  } catch (e) {
    console.error('Config encryption failed:', e);
    return '';
  }
}

/**
 * Decrypt a config object (for future use)
 */
export function decryptConfig(encrypted: string): object | null {
  try {
    return JSON.parse(atob(encrypted));
  } catch (e) {
    console.error('Config decryption failed:', e);
    return null;
  }
}

/**
 * Initialize crypto (no-op for sync implementation, kept for API compatibility)
 */
export async function initCrypto(): Promise<void> {
  // No initialization needed for sync implementation
}

/**
 * Migrate keys (no-op for sync implementation, kept for API compatibility)
 */
export async function migrateToSecureEncryption(): Promise<boolean> {
  // Migration happens automatically via decryptApiKey fallback
  return true;
}
