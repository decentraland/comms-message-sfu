import { ILoggerComponent } from '@well-known-components/interfaces'
import { IPgComponent } from '@well-known-components/pg-component'
import { IDatabaseComponent } from '../../src/adapters/db'
import { IMessageRoutingComponent } from '../../src/logic/message-routing'
import { IDataReceivedHandler } from '../../src/logic/data-received-handler'

export function createTestDBComponent(): jest.Mocked<IDatabaseComponent> {
  return {
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

export function createTestDataReceivedHandlerComponent(): jest.Mocked<IDataReceivedHandler> {
  return {
    handleMessage: jest.fn()
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
