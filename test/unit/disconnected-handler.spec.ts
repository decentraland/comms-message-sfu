import { createDisconnectedHandler, IDisconnectedHandler } from '../../src/logic/connection-handlers/disconnected'
import { createTestLogsComponent } from '../mocks/components'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'
import { MockDisconnectionReason } from '../mocks/livekit'
import { AppComponents } from '../../src/types'

describe('when handling disconnection', () => {
  let disconnectedHandler: IDisconnectedHandler
  let mockReconnect: jest.Mock
  let context: Pick<AppComponents, 'logs' | 'metrics'>

  beforeEach(async () => {
    context = {
      logs: createTestLogsComponent(),
      metrics: createTestMetricsComponent(metricDeclarations)
    }
    disconnectedHandler = await createDisconnectedHandler(context)
    jest.spyOn(context.metrics, 'observe')
    mockReconnect = jest.fn()
  })

  describe('and the connection status is updated', () => {
    it('should set the connection status metric to 0', async () => {
      await disconnectedHandler.handle(mockReconnect)(MockDisconnectionReason.UNKNOWN_REASON as any)
      expect(context.metrics.observe).toHaveBeenCalledWith('livekit_connection_status', {}, 0)
    })
  })

  describe('and the disconnect requires reconnection', () => {
    const reconnectReasons = [
      MockDisconnectionReason.SERVER_SHUTDOWN,
      MockDisconnectionReason.PARTICIPANT_REMOVED,
      MockDisconnectionReason.STATE_MISMATCH,
      MockDisconnectionReason.JOIN_FAILURE,
      MockDisconnectionReason.MIGRATION,
      MockDisconnectionReason.SIGNAL_CLOSE,
      MockDisconnectionReason.ROOM_CLOSED
    ]

    test.each(reconnectReasons)('should attempt to reconnect when reason is %s', async (reason) => {
      await disconnectedHandler.handle(mockReconnect)(reason as any)
      expect(mockReconnect).toHaveBeenCalled()
    })
  })

  describe('and the disconnect does not require reconnection', () => {
    const noReconnectReasons = [
      MockDisconnectionReason.CLIENT_INITIATED,
      MockDisconnectionReason.ROOM_DELETED,
      MockDisconnectionReason.DUPLICATE_IDENTITY,
      MockDisconnectionReason.USER_UNAVAILABLE,
      MockDisconnectionReason.USER_REJECTED,
      MockDisconnectionReason.SIP_TRUNK_FAILURE
    ]

    test.each(noReconnectReasons)('should not attempt to reconnect when reason is %s', async (reason) => {
      await disconnectedHandler.handle(mockReconnect)(reason as any)
      expect(mockReconnect).not.toHaveBeenCalled()
    })
  })

  describe('and the reconnect attempt fails', () => {
    it('should propagate the error', async () => {
      const error = new Error('Connection failed')
      mockReconnect.mockRejectedValueOnce(error)

      await expect(
        disconnectedHandler.handle(mockReconnect)(MockDisconnectionReason.SERVER_SHUTDOWN as any)
      ).rejects.toThrow('Connection failed')
    })
  })
})
