import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TooManyRequests", message: "Too many requests, please try again later." },
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TooManyRequests", message: "Too many authentication attempts. Please wait 15 minutes." },
  keyGenerator: (req) => ipKeyGenerator(req),
});

export const transactionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TooManyRequests", message: "Transaction rate limit exceeded. Max 5 transactions per minute." },
  keyGenerator: (req) => {
    const authReq = req as { userId?: number };
    return authReq.userId ? `user-${authReq.userId}` : ipKeyGenerator(req);
  },
  validate: { xForwardedForHeader: false },
});
