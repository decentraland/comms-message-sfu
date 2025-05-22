import { createConnectedHandler } from '../../src/logic/connection-handlers/connected'
import { createTestLogsComponent } from '../mocks/components'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'

describe('when handling connected event', () => {
  let connectedHandler: Awaited<ReturnType<typeof createConnectedHandler>>
  let mockMetrics: jest.Mocked<any>

  beforeEach(async () => {
    mockMetrics = createTestMetricsComponent(metricDeclarations)

    connectedHandler = await createConnectedHandler({
      logs: createTestLogsComponent(),
      metrics: mockMetrics
    })

    jest.spyOn(mockMetrics, 'observe')
  })

  it('should modify the connection status metric', () => {
    connectedHandler.handle()
    expect(mockMetrics.observe).toHaveBeenCalledWith('livekit_connection_status', {}, 1)
  })
})
