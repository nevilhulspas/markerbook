/**
 * Response headers applied to every route (wired in next.config.ts).
 *
 * The CSP's main job is to stop data leaving the page: a prompt-injected model
 * answer that slips a remote image or fetch past the markdown renderer can only
 * reach our own origin and Supabase. Everything the browser loads comes from:
 * - 'self': Next.js chunks, self-hosted next/font files, /api/* (all Anthropic
 *   and OpenAI calls run server-side), the bundled pdf.js worker.
 * - Supabase (`NEXT_PUBLIC_SUPABASE_URL`): auth, signed storage URLs shown as
 *   <img> and fetched by react-pdf.
 * - data:/blob:: camera photos (Capacitor returns a data: URL that is fetched),
 *   object URLs for previews and CSV/PDF downloads.
 * - Google's favicon service for web-search source chips (it redirects to
 *   *.gstatic.com).
 */

interface SecurityHeaderOptions {
  /** NEXT_PUBLIC_SUPABASE_URL; omitted from the policy when unset or invalid. */
  supabaseUrl?: string
  isDev: boolean
}

const LOCAL_SUPABASE = ['http://127.0.0.1:54321', 'http://localhost:54321']

function supabaseOrigins(supabaseUrl: string | undefined, isDev: boolean) {
  const http: string[] = []
  const ws: string[] = []
  const add = (raw: string) => {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return
    if (!http.includes(url.origin)) {
      http.push(url.origin)
      ws.push(`${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`)
    }
  }
  if (supabaseUrl) add(supabaseUrl)
  if (isDev) LOCAL_SUPABASE.forEach(add)
  return { http, ws }
}

export function buildContentSecurityPolicy({ supabaseUrl, isDev }: SecurityHeaderOptions): string {
  const supabase = supabaseOrigins(supabaseUrl, isDev)

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Next.js inlines bootstrap scripts; dev mode (React refresh) also needs eval.
    // 'wasm-unsafe-eval' lets pdf.js compile its WebAssembly image decoders.
    'script-src': ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...supabase.http, 'https://www.google.com', 'https://*.gstatic.com'],
    'font-src': ["'self'", 'data:'],
    // ws:/wss: in dev only, for the HMR socket (also behind portless https).
    'connect-src': ["'self'", 'data:', 'blob:', ...supabase.http, ...supabase.ws, ...(isDev ? ['ws:', 'wss:'] : [])],
    'media-src': ["'self'", 'blob:', 'data:'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(options) },
    // HSTS only means something over https; leave local dev (incl. portless) alone.
    ...(options.isDev
      ? []
      : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Camera: nutrition photo capture. Microphone: voice logging.
    {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()',
    },
  ]
}
