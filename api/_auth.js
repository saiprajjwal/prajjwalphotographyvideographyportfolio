import crypto from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Reuses ADMIN_PASSWORD as the HMAC key so no separate secret needs configuring.
export function signToken() {
  const secret = process.env.ADMIN_PASSWORD;
  const expires = Date.now() + TOKEN_TTL_MS;
  const hmac = crypto.createHmac('sha256', secret).update(String(expires)).digest('hex');
  return `${expires}.${hmac}`;
}

export function verifyToken(token) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || !token || typeof token !== 'string' || !token.includes('.')) return false;

  const [expiresStr, hmac] = token.split('.');
  const expires = Number(expiresStr);
  if (!expires || Date.now() > expires) return false;

  const expected = crypto.createHmac('sha256', secret).update(expiresStr).digest('hex');
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
