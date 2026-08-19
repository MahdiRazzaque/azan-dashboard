# MIDDLEWARE KNOWLEDGE BASE

Express 5 middleware suite for authentication, error handling, rate limiting, and file processing.

## FILES

| File            | Role                                                                | Applied Where                                                 |
| :-------------- | :------------------------------------------------------------------ | :------------------------------------------------------------ |
| auth.js         | JWT verification from httpOnly cookie                               | All /api routes except /api/auth/login and /api/auth/setup    |
| errorHandler.js | Centralized Express error middleware; formats JSON response         | Applied last in routes/index.js; catches all thrown/next(err) |
| rateLimiters.js | Exports Bottleneck-based limiters (security, operations, read, sse) | Applied in routes/index.js per sub-router                     |
| fileUpload.js   | Multer config for MP3 file uploads; validates type/size             | Per-route on upload endpoints                                 |
| storageCheck.js | Checks disk quota before allowing write operations                  | Applied before fileUpload on upload routes                    |
| asyncHandler.js | Wraps async route handlers to catch rejected promises               | Per-handler in controller route definitions                   |

## APPLICATION ORDER

```
1. Global: no-cache headers (all responses)
2. Global: readLimiter / operationsLimiter (per sub-router)
3. Per-route: auth.js (JWT check)
4. Per-route: storageCheck → fileUpload (upload endpoints only)
5. Per-handler: asyncHandler (wraps each controller method)
6. Final: errorHandler (catch-all, must be last)
```

## CONVENTIONS

- Middleware order in routes/index.js is load-bearing — errorHandler MUST be last
- Rate limiters use Bottleneck (not express-rate-limit) — token bucket, not sliding window
- Auth middleware reads JWT from `token` cookie, not Authorization header
- asyncHandler is required on ALL async controller methods — Express 5 handles this natively but we use it for consistency

## ANTI-PATTERNS

- Never add middleware after errorHandler in routes/index.js
- Never skip asyncHandler on async route handlers
- Never hardcode rate limit values — they come from constants
