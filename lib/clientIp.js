// lib/clientIp.js
// ---------------------------------------------------------------
// Returns the real visitor IP no matter which proxy/CDN is in front.
//
// Set CLIENT_IP_HEADER in your env to match what sits in front of the app:
//   Bunny CDN (Pull Zone)  -> x-real-ip        (default; Bunny overwrites it)
//   Cloudflare proxy       -> cf-connecting-ip (Cloudflare overwrites it)
//   Nothing / direct       -> leave default; falls back to socket address
//
// Only trust a header that your CDN overwrites. Never mix them: a visitor
// can send any header themselves, and only the CDN's own header is reliable.
// ---------------------------------------------------------------

const TRUSTED_HEADER = (process.env.CLIENT_IP_HEADER || 'x-real-ip').toLowerCase();

export function getClientIp(req) {
  const first = (v) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim();

  return (
    first(req.headers[TRUSTED_HEADER]) ||
    first(req.headers['x-forwarded-for']) ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
