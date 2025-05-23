import { createReconnectedHandler } from '../../src/logic/connection-handlers/reconnected'
import { createTestLogsComponent } from '../mocks/components'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'

describe('when handling reconnected event', () => {
  let reconnectedHandler: Awaited<ReturnType<typeof createReconnectedHandler>>
  let mockMetrics: jest.Mocked<any>

  beforeEach(async () => {
    mockMetrics = createTestMetricsComponent(metricDeclarations)

    reconnectedHandler = await createReconnectedHandler({
      logs: createTestLogsComponent(),
      metrics: mockMetrics
    })

    jest.spyOn(mockMetrics, 'observe')
  })

  it('should modify the connection status metric', () => {
    reconnectedHandler.handle()
    expect(mockMetrics.observe).toHaveBeenCalledWith('livekit_connection_status', {}, 1)
  })
})
