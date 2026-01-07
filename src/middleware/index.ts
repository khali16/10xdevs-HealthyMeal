import { defineMiddleware } from 'astro:middleware';

import { supabaseClient } from '../db/supabase.client.ts';

const MAX_JSON_BODY_BYTES = 256 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.supabase = supabaseClient;

  const path = context.url.pathname;
  if (path.startsWith('/api/')) {
    const ip = context.clientAddress ?? 'unknown';
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
      bucket.count += 1;
      if (bucket.count > RATE_LIMIT_MAX) {
        return new Response(
          JSON.stringify({ error: { code: 'RATE_LIMIT', message: 'Too Many Requests' } }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    const ct = context.request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const contentLength = context.request.headers.get('content-length');
      if (contentLength) {
        const size = Number(contentLength);
        if (!Number.isNaN(size) && size > MAX_JSON_BODY_BYTES) {
          return new Response(
            JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request entity too large' } }),
            { status: 413, headers: { 'Content-Type': 'application/json' } },
          );
        }
      }
    }
  }

  return next();
});
