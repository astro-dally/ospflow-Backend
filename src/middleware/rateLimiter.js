const rateLimit = require("express-rate-limit")
const config = require("../config/config")

// Standard rate limiter without Redis store (memory-based)
exports.standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// Authentication rate limiter (more strict)
exports.authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 login/signup requests per hour
  message: "Too many authentication attempts, please try again after an hour",
  standardHeaders: true,
  legacyHeaders: false,
})

// API rate limiter
exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: "Too many API requests, please try again after a minute",
  standardHeaders: true,
  legacyHeaders: false,
})

// Note: Redis store has been temporarily disabled to fix the connection error.
// To re-enable Redis for production, you'll need to:
// 1. Install compatible versions of rate-limit-redis and ioredis
// 2. Configure the Redis client properly
