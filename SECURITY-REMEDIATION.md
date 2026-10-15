# Security remediation — 2026-10-15

These changes require review and staged deployment. No production secrets or live services were used during verification. Dependency locks were regenerated with install scripts disabled. Offline regression tests run with `node --test test/*.test.mjs` (Node 24 for direct TypeScript imports).

## Paid provider access

All provider routes now require `Authorization: Bearer <PAID_PROXY_SECRET>` with a randomly generated secret of at least 32 characters. This credential is for a trusted application backend only. Never place it in a browser bundle, mobile application, public environment variable, query string, or local storage. A legitimate frontend should authenticate to its own backend; that backend must enforce each user's authorization and quota before attaching the proxy credential to the server request.

Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Missing authentication or quota configuration and Redis failures reject requests before provider work. Redis atomically enforces a deployment-wide minute/day request budget (defaults 10/100; configurable using `PAID_MAX_REQUESTS_PER_MINUTE` / `PAID_MAX_REQUESTS_PER_DAY`). This request budget is not a dollar budget; keep provider account spending caps enabled. Model allowlists use `PAID_ALLOWED_MODELS` (default `gpt-4o-mini`). Bodies are streamed with size limits; text completion output is capped. Long-lived jobs and provider-specific billing must also be capped in the provider dashboard.

Old direct browser integrations must move to that trusted backend flow before enabling these routes. Use a new secret and do not reuse a secret previously embedded in a client.

The existing `PROXY_SECRET` check remains as an optional additional check; `PAID_PROXY_SECRET` and the shared persistent quota are always required. Plant image requests are capped at 8 MB, and generation output is capped at 1024 tokens. Next is pinned to 15.5.28. Verify a representative image in staging before deployment.
