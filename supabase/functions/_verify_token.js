/**
 * Two Knights Token Verification Module
 * Verifies custom HS256 JWTs issued by the auth Edge Function.
 */

export function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64UrlDecodeToString(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

export async function verifySignedToken(token) {
  const secret = Deno.env.get('JWT_SECRET') || '';
  if (!secret || !token.includes('.')) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT' || header?.aud !== 'twoknights-api' || header?.iss !== 'twoknights-auth') return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signature = base64UrlDecode(parts[2]);
    const verified = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts[0] + '.' + parts[1]));
    if (!verified) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    const exp = Number(payload.exp || 0);
    if (exp && exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}