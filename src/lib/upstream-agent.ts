import { Agent, RetryAgent } from "undici";

/**
 * Shared HTTP dispatcher for LLM provider upstream calls.
 *
 * Why the wrapper:
 *   Node/undici has a well-known race condition where keep-alive sockets
 *   are returned to the pool just as the remote side closes them, and the
 *   very next fetch picks that dead socket and throws
 *   `TypeError: fetch failed` with `cause.code === "UND_ERR_SOCKET"`
 *   (or ECONNRESET / "other side closed"). It happened here specifically
 *   on Groq/Mistral where batched requests hit the same pooled socket
 *   microseconds after the server sent FIN.
 *
 *   RetryAgent transparently retries on those low-level codes with a
 *   fresh socket, so the caller never sees the transient error.
 *
 * Tuning:
 *   - keepAliveTimeout: 4s — shorter than most cloud LB idle timeouts (5-10s),
 *     so undici discards its side before the server closes.
 *   - connections: 128 per origin — enough concurrency for burst traffic.
 *   - connect.timeout: 15s — some CDN POPs are slow on cold TLS.
 *   - pipelining: 0 — chat APIs may stream; pipelining is unsafe here.
 *
 * Not registered globally: each upstream callsite imports `upstreamAgent`
 * explicitly via `fetch(url, { dispatcher: upstreamAgent })`.
 */
const baseAgent = new Agent({
  keepAliveTimeout: 4_000,
  keepAliveMaxTimeout: 10_000,
  connections: 128,
  connect: { timeout: 15_000 },
  pipelining: 0,
});

export const upstreamAgent = new RetryAgent(baseAgent, {
  maxRetries: 2,
  minTimeout: 100,
  maxTimeout: 1_000,
  timeoutFactor: 2,
  retryAfter: true,
  methods: ["GET", "POST"],
  statusCodes: [], // don't retry on HTTP status — that's the app's job
  errorCodes: [
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ENETDOWN",
    "ENETUNREACH",
    "EHOSTDOWN",
    "UND_ERR_SOCKET",
    "UND_ERR_CLOSED",
  ],
});
