import { IBaseComponent, START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { AppComponents } from '../types'

export type IRateLimiterComponent = IBaseComponent & {
  /**
   * Attempts to consume a single token for the given key (e.g. a participant identity).
   *
   * @param key - The bucket key to rate limit on (a participant identity).
   * @returns `true` when the call is within the configured rate limit and a token was
   * consumed, or `false` when the caller has exhausted their allowance and should be throttled.
   */
  isAllowed: (key: string) => boolean
}

type TokenBucket = {
  tokens: number
  lastRefill: number
}

/**
 * Creates an in-memory, per-key token-bucket rate limiter.
 *
 * Each key (a participant identity) gets a bucket that starts full and refills continuously
 * at `RATE_LIMIT_REFILL_RATE_PER_SECOND` up to a ceiling of `RATE_LIMIT_MAX_TOKENS`, which
 * also acts as the burst allowance. A periodic sweep drops buckets that have been idle long
 * enough to be fully refilled — an idle full bucket is indistinguishable from a fresh one, so
 * dropping it keeps memory bounded without changing behaviour.
 *
 * @param components - The config and logs components.
 * @returns A rate limiter component exposing `isAllowed` plus start/stop lifecycle hooks.
 */
export async function createRateLimiterComponent(
  components: Pick<AppComponents, 'config' | 'logs'>
): Promise<IRateLimiterComponent> {
  const { config, logs } = components
  const logger = logs.getLogger('rate-limiter')

  const maxTokens = (await config.getNumber('RATE_LIMIT_MAX_TOKENS')) ?? 10
  const refillRatePerSecond = (await config.getNumber('RATE_LIMIT_REFILL_RATE_PER_SECOND')) ?? 5
  const cleanupIntervalMs = (await config.getNumber('RATE_LIMIT_CLEANUP_INTERVAL_MS')) ?? 60_000

  // Time it takes for an empty bucket to refill completely. A bucket untouched for at least
  // this long is equivalent to a fresh one, so it can be dropped to keep memory bounded.
  const fullRefillMs = (maxTokens / refillRatePerSecond) * 1000

  const buckets = new Map<string, TokenBucket>()
  let cleanupTimer: ReturnType<typeof setInterval> | null = null

  function isAllowed(key: string): boolean {
    const now = Date.now()
    let bucket = buckets.get(key)

    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now }
      buckets.set(key, bucket)
    } else {
      const elapsedMs = now - bucket.lastRefill
      if (elapsedMs > 0) {
        bucket.tokens = Math.min(maxTokens, bucket.tokens + (elapsedMs / 1000) * refillRatePerSecond)
        bucket.lastRefill = now
      }
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return true
    }

    return false
  }

  function cleanup() {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill >= fullRefillMs) {
        buckets.delete(key)
      }
    }
  }

  return {
    isAllowed,
    [START_COMPONENT]: async () => {
      logger.debug('Starting rate limiter', { maxTokens, refillRatePerSecond, cleanupIntervalMs })
      cleanupTimer = setInterval(cleanup, cleanupIntervalMs)
      // Don't keep the event loop alive solely for the cleanup timer.
      cleanupTimer.unref?.()
    },
    [STOP_COMPONENT]: async () => {
      if (cleanupTimer) {
        clearInterval(cleanupTimer)
        cleanupTimer = null
      }
      buckets.clear()
    }
  }
}
