import { Agent } from "undici";

/**
 * Shared HTTP agent for all LLM provider upstream calls.
 * - 128 connections per origin so multiple in-flight calls to the same provider don't queue
 * - 30s keep-alive so batches inside the same minute reuse the TLS handshake
 * - 15s connect timeout — some cloud LLM endpoints take 8-12s to complete TLS
 *   handshake on cold start, especially when accessed through distant CDN POPs.
 *   Tighter (5s) caused spurious "fetch failed" errors during bulk worker
 *   health checks, knocking good models into cooldown.
 *
 * NOT registered globally via setGlobalDispatcher — previously doing so broke
 * local image-URL downloads and other non-LLM fetches that have different
 * latency profiles. Each upstream callsite imports this agent explicitly.
 */
export const upstreamAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 128,
  connect: { timeout: 15_000 },
  pipelining: 0, // safe default for chat APIs that may stream
});
