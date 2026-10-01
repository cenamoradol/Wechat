const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetIn: b.resetAt - now };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, resetIn: b.resetAt - now };
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export const limits = {
  login: (ip: string) => rateLimit(`login:${ip}`, 5, 15 * 60 * 1000),
  signup: (ip: string) => rateLimit(`signup:${ip}`, 3, 60 * 60 * 1000),
  forgot: (ip: string) => rateLimit(`forgot:${ip}`, 3, 60 * 60 * 1000),
};