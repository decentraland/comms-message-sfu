import { createDisconnectedHandler } from '../../src/logic/connection-handlers/disconnected'
import { createTestLogsComponent } from '../mocks/components'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'

describe('when handling disconnected event', () => {
  let disconnectedHandler: Awaited<ReturnType<typeof createDisconnectedHandler>>
  let mockMetrics: jest.Mocked<any>
  let mockConnect: jest.Mock

  beforeEach(async () => {
    mockMetrics = createTestMetricsComponent(metricDeclarations)
    mockConnect = jest.fn()

    disconnectedHandler = await createDisconnectedHandler({
      logs: createTestLogsComponent(),
      metrics: mockMetrics
    })

    jest.spyOn(mockMetrics, 'observe')
  })

  it('should modify the connection status metric and attempt to reconnect', async () => {
    await disconnectedHandler.handle(mockConnect)('test-reason' as any)
    expect(mockMetrics.observe).toHaveBeenCalledWith('livekit_connection_status', {}, 0)
    expect(mockConnect).toHaveBeenCalled()
  })

  it('should propagate reconnection errors', async () => {
    const error = new Error('Connection failed')
    mockConnect.mockRejectedValueOnce(error)

    await expect(disconnectedHandler.handle(mockConnect)('test-reason' as any)).rejects.toThrow('Connection failed')
  })
})
