import { defineMiddleware } from 'astro:middleware';

import { createSupabaseServerInstance } from '../db/supabase.client.ts';

const MAX_JSON_BODY_BYTES = 256 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const PUBLIC_PATHS = new Set([
  '/',
  '/favicon.ico',
  '/favicon.png',
  '/robots.txt',
  '/sitemap.xml',
]);

const isPublicPath = (path: string): boolean => {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path.startsWith('/_astro/')) return true;
  if (path.startsWith('/auth/')) return true;
  if (path.startsWith('/api/auth/')) return true;
  return false;
};

const toReturnTo = (url: URL): string => `${url.pathname}${url.search}`;

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  });

  const path = context.url.pathname;
  const isPublic = isPublicPath(path);

  if (!isPublic) {
    const {
      data: { user },
    } = await context.locals.supabase.auth.getUser();

    if (user) {
      context.locals.user = {
        email: user.email,
        id: user.id,
      };
    } else if (path.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    } else {
      const returnTo = toReturnTo(context.url);
      return context.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }

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
