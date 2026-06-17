import { IConfigComponent, ILoggerComponent } from '@well-known-components/interfaces'
import { IPgComponent } from '@well-known-components/pg-component'
import { IDatabaseComponent } from '../../src/adapters/db'
import { IRateLimiterComponent } from '../../src/adapters/rate-limiter'
import { IMessageRoutingComponent } from '../../src/logic/message-routing'

export function createTestDBComponent(): jest.Mocked<IDatabaseComponent> {
  return {
    belongsToCommunity: jest.fn(),
    getCommunityMembers: jest.fn()
  }
}

export function createTestLogsComponent(): jest.Mocked<ILoggerComponent> {
  return {
    getLogger: jest.fn().mockReturnValue({
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn()
    })
  }
}

export function createTestMessageRoutingComponent(): jest.Mocked<IMessageRoutingComponent> {
  return {
    routeMessage: jest.fn()
  }
}

export function createTestRateLimiterComponent(): jest.Mocked<IRateLimiterComponent> {
  return {
    isAllowed: jest.fn().mockReturnValue(true)
  } as jest.Mocked<IRateLimiterComponent>
}

export function createTestConfigComponent(values: Record<string, string | number> = {}): jest.Mocked<IConfigComponent> {
  return {
    getString: jest.fn(async (name: string) => {
      const value = values[name]
      return value === undefined ? undefined : String(value)
    }),
    getNumber: jest.fn(async (name: string) => {
      const value = values[name]
      return value === undefined ? undefined : Number(value)
    }),
    requireString: jest.fn(async (name: string) => String(values[name])),
    requireNumber: jest.fn(async (name: string) => Number(values[name]))
  }
}

export function createTestHandlerComponent(): jest.Mocked<{ handle: (...args: any[]) => Promise<void> }> {
  return {
    handle: jest.fn()
  }
}

export function createTestPgComponent(): jest.Mocked<IPgComponent> {
  return {
    query: jest.fn(),
    start: jest.fn(),
    streamQuery: jest.fn(),
    getPool: jest.fn(),
    stop: jest.fn()
  }
}
