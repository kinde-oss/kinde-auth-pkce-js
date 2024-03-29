// Calculate the SHA256 hash of the input text.
// Returns a promise that resolves to an ArrayBuffer
export function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}
