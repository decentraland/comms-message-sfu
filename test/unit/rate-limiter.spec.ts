import { IConfigComponent, ILoggerComponent, START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { createRateLimiterComponent, IRateLimiterComponent } from '../../src/adapters/rate-limiter'
import { createTestConfigComponent, createTestLogsComponent } from '../mocks/components'

describe('when rate limiting calls per key', () => {
  let rateLimiter: IRateLimiterComponent
  let mockConfig: jest.Mocked<IConfigComponent>
  let mockLogs: jest.Mocked<ILoggerComponent>

  const key = 'test-user'
  const maxTokens = 3
  const refillRatePerSecond = 1
  const cleanupIntervalMs = 1000

  beforeEach(async () => {
    jest.useFakeTimers()
    jest.setSystemTime(0)

    mockConfig = createTestConfigComponent({
      RATE_LIMIT_MAX_TOKENS: maxTokens,
      RATE_LIMIT_REFILL_RATE_PER_SECOND: refillRatePerSecond,
      RATE_LIMIT_CLEANUP_INTERVAL_MS: cleanupIntervalMs
    })
    mockLogs = createTestLogsComponent()

    rateLimiter = await createRateLimiterComponent({ config: mockConfig, logs: mockLogs })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('when checking if a call is allowed', () => {
    describe('and the key has its full burst allowance available', () => {
      it('should allow up to the configured burst of calls', () => {
        const results = Array.from({ length: maxTokens }, () => rateLimiter.isAllowed(key))

        expect(results).toEqual([true, true, true])
      })
    })

    describe('and the burst allowance has been exhausted', () => {
      beforeEach(() => {
        for (let i = 0; i < maxTokens; i++) {
          rateLimiter.isAllowed(key)
        }
      })

      it('should reject the next call', () => {
        expect(rateLimiter.isAllowed(key)).toBe(false)
      })
    })

    describe('and tokens have refilled after enough time has passed', () => {
      beforeEach(() => {
        for (let i = 0; i < maxTokens; i++) {
          rateLimiter.isAllowed(key)
        }
        // One full second refills exactly one token at 1 token/second.
        jest.advanceTimersByTime(1000)
      })

      it('should allow a call again', () => {
        expect(rateLimiter.isAllowed(key)).toBe(true)
      })
    })

    describe('and different keys are used', () => {
      beforeEach(() => {
        for (let i = 0; i < maxTokens; i++) {
          rateLimiter.isAllowed(key)
        }
      })

      it('should track each key independently', () => {
        expect(rateLimiter.isAllowed('another-user')).toBe(true)
      })
    })
  })

  describe('when the component is started', () => {
    afterEach(async () => {
      await rateLimiter[STOP_COMPONENT]!()
    })

    it('should schedule a periodic cleanup timer', async () => {
      await rateLimiter[START_COMPONENT]!({} as any)

      expect(jest.getTimerCount()).toBe(1)
    })

    it('should keep rate limiting functional after the periodic cleanup prunes idle buckets', async () => {
      await rateLimiter[START_COMPONENT]!({} as any)
      for (let i = 0; i < maxTokens; i++) {
        rateLimiter.isAllowed(key)
      }

      // Run the cleanup interval past the full-refill window so the now-idle bucket is pruned.
      jest.advanceTimersByTime((maxTokens / refillRatePerSecond) * 1000)

      expect(rateLimiter.isAllowed(key)).toBe(true)
    })
  })

  describe('when the component is stopped', () => {
    beforeEach(async () => {
      await rateLimiter[START_COMPONENT]!({} as any)
      for (let i = 0; i < maxTokens; i++) {
        rateLimiter.isAllowed(key)
      }
    })

    it('should clear the cleanup timer', async () => {
      await rateLimiter[STOP_COMPONENT]!()

      expect(jest.getTimerCount()).toBe(0)
    })

    it('should clear stored buckets so a previously throttled key is allowed again', async () => {
      await rateLimiter[STOP_COMPONENT]!()

      expect(rateLimiter.isAllowed(key)).toBe(true)
    })
  })
})
