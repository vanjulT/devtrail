// A small "speed limit" for our API: each visitor may make at most `max` requests in `windowMs`.
// It protects our free AI keys (and the login form) from someone sending thousands of requests.
// The counts live in memory: simple, and enough for one server.
export default function rateLimit({ windowMs, max, message }) {
  const visitors = new Map(); // ip → { count, resetAt }

  // Forget old visitors now and then, so the memory does not grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of visitors) {
      if (entry.resetAt <= now) visitors.delete(ip);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    let entry = visitors.get(req.ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      visitors.set(req.ip, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const waitSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", waitSeconds);
      return res.status(429).json({ message: `${message} Please try again in ${waitSeconds} seconds.` });
    }
    next();
  };
}