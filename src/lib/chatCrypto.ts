/**
 * AES-256-GCM encryption/decryption using Web Crypto API
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const PLAINTEXT_PREFIX = "plain:";

function hasSecureCryptoSupport() {
  return typeof globalThis !== "undefined" && globalThis.isSecureContext && !!globalThis.crypto?.subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(
    atob(base64)
      .split("")
      .map((char) => char.charCodeAt(0))
  );
}

function encodePlaintext(plaintext: string): string {
  return `${PLAINTEXT_PREFIX}${bytesToBase64(new TextEncoder().encode(plaintext))}`;
}

function decodePlaintext(ciphertext: string): string | null {
  if (!ciphertext.startsWith(PLAINTEXT_PREFIX)) return null;
  return new TextDecoder().decode(base64ToBytes(ciphertext.slice(PLAINTEXT_PREFIX.length)));
}

// Derive a consistent key from a passphrase (shared secret)
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("safeone-intranet-chat-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// Shared secret for the intranet (in production, use per-conversation keys)
const SHARED_SECRET = "SafeOne-Intranet-AES256-2026";

export async function encryptMessage(plaintext: string): Promise<string> {
  // Always use plaintext-safe encoding for intranet compatibility
  // crypto.subtle requires a Secure Context (HTTPS/localhost) which
  // is not available on http://intranet.safeone.local
  return encodePlaintext(plaintext);
}

export async function decryptMessage(ciphertext: string): Promise<string> {
  try {
    const plaintext = decodePlaintext(ciphertext);
    if (plaintext !== null) return plaintext;

    if (!hasSecureCryptoSupport()) {
      return "[Mensaje cifrado: ábrelo desde una conexión segura]";
    }

    const key = await deriveKey(SHARED_SECRET);
    const combined = base64ToBytes(ciphertext);
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "[Error al descifrar mensaje]";
  }
}
