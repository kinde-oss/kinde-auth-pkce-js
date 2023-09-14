// Base64-urlencodes the input string
export function base64UrlEncode(str: ArrayBuffer): string {
  // Convert the ArrayBuffer to string using Uint8 array to conver to what btoa accepts.
  // btoa accepts chars only within ascii 0-255 and base64 encodes them.
  // Then convert the base64 encoded to base64url encoded
  //   (replace + with -, replace / with _, trim trailing =)
  const numberArray = Array.from<number>(new Uint8Array(str));
  return btoa(String.fromCharCode.apply(null, numberArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
