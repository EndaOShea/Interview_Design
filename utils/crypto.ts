/**
 * Simple client-side encryption for sensitive data in localStorage
 * Note: This provides obfuscation, not true security. For production,
 * consider a backend solution or browser crypto API with user-provided passwords.
 */

const SALT = 'architectai-v1'; // Static salt for basic obfuscation

/**
 * Simple XOR cipher with salt for basic obfuscation
 * Better than base64, but still not cryptographically secure
 */
export function encryptApiKey(key: string): string {
  if (!key) return '';

  try {
    // Combine key with salt and encode
    const combined = key + '::' + SALT;
    const encoded = btoa(combined);

    // Additional XOR obfuscation
    let result = '';
    for (let i = 0; i < encoded.length; i++) {
      const charCode = encoded.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
      result += String.fromCharCode(charCode);
    }

    return btoa(result); // Final base64 encoding
  } catch (e) {
    console.error('Encryption failed:', e);
    return '';
  }
}

/**
 * Decrypt API key from localStorage
 */
export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return '';

  try {
    // Reverse base64
    const decoded = atob(encrypted);

    // Reverse XOR
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
      result += String.fromCharCode(charCode);
    }

    // Decode and extract key
    const combined = atob(result);
    const [key, salt] = combined.split('::');

    if (salt !== SALT) {
      throw new Error('Invalid encryption');
    }

    return key;
  } catch (e) {
    console.error('Decryption failed:', e);
    return '';
  }
}
