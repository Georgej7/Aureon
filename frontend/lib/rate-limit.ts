// Minimal in-memory fixed-window rate limiter for Next.js Route Handlers.
// Deliberately not Redis/Upstash-backed: this app runs as a single Render
// instance today, and the two call sites using this (emails/welcome,
// geocode) just need "stop an obvious flood," not distributed-accurate
// limiting. Resets on every deploy/restart and won't coordinate across
// multiple instances -- fine at current scale, but note this if the app
// ever moves to a multi-instance/serverless deployment, since each instance
// would then track its own separate counts.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Bounds memory under sustained abuse from many distinct keys -- without
// this, an attacker cycling through many fake IPs/emails could grow this
// map indefinitely between the periodic expired-entry sweeps below.
const MAX_TRACKED_KEYS = 5000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

// Best-effort caller IP for a Next.js Route Handler request. Render (and
// most platforms fronting Next with a proxy) sets x-forwarded-for; falls
// back to a constant so an unrecognized deployment still rate-limits
// globally rather than throwing.
export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
