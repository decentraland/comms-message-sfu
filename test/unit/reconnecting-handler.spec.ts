import { createReconnectingHandler } from '../../src/logic/connection-handlers/reconnecting'
import { createTestLogsComponent } from '../mocks/components'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'

describe('when handling reconnecting event', () => {
  let reconnectingHandler: Awaited<ReturnType<typeof createReconnectingHandler>>
  let mockMetrics: jest.Mocked<any>

  beforeEach(async () => {
    mockMetrics = createTestMetricsComponent(metricDeclarations)

    reconnectingHandler = await createReconnectingHandler({
      logs: createTestLogsComponent(),
      metrics: mockMetrics
    })

    jest.spyOn(mockMetrics, 'observe')
  })

  it('should modify the connection status metric', () => {
    reconnectingHandler.handle()
    expect(mockMetrics.observe).toHaveBeenCalledWith('livekit_connection_status', {}, 0)
  })
})
