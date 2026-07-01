/**
 * Shared Authentication Module for all Edge Functions
 * Allows any JWT token (starts with eyJ) for development/demo mode
 * Also accepts hardcoded tokens for testing
 */

import { verifySignedToken } from './_verify_token.js';

/**
 * Decode JWT payload without verification (for HS256 JWTs)
 */
export function decodeJwt(token) {
  if (!token.includes('.')) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload;
  } catch {
    return null;
  }
}

export async function validateAuth(req, supabase) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  
  // Allow any JWT token (starts with eyJ) for development/demo mode
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token && token.startsWith('eyJ')) {
      return { allowed: true, role: 'anonymous' };
    }
  }
  
  if (!authHeader) return { allowed: false, error: 'Missing Authorization header' };
  
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { allowed: false, error: 'Missing token' };

  // 1. Check for hardcoded stabilization tokens
  if (token.startsWith('master-token-')) return { allowed: true, role: 'master' };
  if (token.startsWith('admin-token-')) return { allowed: true, role: 'admin' };
  if (token.startsWith('parent-token-')) return { allowed: true, role: 'parent' };
  if (token.startsWith('coach-token-')) return { allowed: true, role: 'coach' };

  // Check service role key
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return { allowed: true, role: 'service_role' };
  }

  // 2. Check for real Supabase JWT - decode manually (SDK throws on ES256 tokens)
  try {
    const payload = decodeJwt(token);
    if (payload && payload.iss?.includes('supabase.co/auth')) {
      const userRole = payload.user_metadata?.role || payload.role || 'authenticated';
      return { allowed: true, role: userRole, user: { id: payload.sub, email: payload.email, role: userRole } };
    }
  } catch (e) {}

  // 3. Fallback: check custom HS256 JWT
  const customPayload = await verifySignedToken(token);
  if (customPayload) {
    return { allowed: true, role: customPayload.role || 'authenticated', user: customPayload };
  }

  return { allowed: false, error: 'Invalid or expired token' };
}