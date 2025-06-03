// test/unit/data-received-handler.spec.ts

import { createDataReceivedHandler, IDataReceivedHandler } from '../../src/logic/data-received-handler'
import { createTestLogsComponent, createTestMessageRoutingComponent } from '../mocks/components'
import { mockRoom } from '../mocks/livekit'
import { IMessageRoutingComponent } from '../../src/logic/message-routing'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'

describe('when handling data received', () => {
  let dataReceivedHandler: IDataReceivedHandler
  let mockMessageRouting: jest.Mocked<IMessageRoutingComponent>
  let handleMessage: (payload: Uint8Array, participant?: any, kind?: number, topic?: string) => Promise<void>

  const identity = 'test-prefix-0'

  beforeEach(async () => {
    mockMessageRouting = createTestMessageRoutingComponent()

    dataReceivedHandler = await createDataReceivedHandler({
      logs: createTestLogsComponent(),
      messageRouting: mockMessageRouting,
      metrics: createTestMetricsComponent(metricDeclarations)
    })

    handleMessage = dataReceivedHandler.handle(mockRoom as any, identity)
  })

  const payload = new Uint8Array([1, 2, 3])
  const participant = { identity: 'test-user' }
  const kind = 1 // KIND_LOSSY
  const topic = 'community:test-community'

  it('should route message when valid data is received', async () => {
    await handleMessage(payload, participant, kind, topic)

    expect(mockMessageRouting.routeMessage).toHaveBeenCalledWith(
      mockRoom,
      expect.objectContaining({
        payload,
        from: 'test-user',
        communityId: 'test-community'
      })
    )
  })

  it('should not route message when participant is missing', async () => {
    await handleMessage(payload, undefined, kind, topic)

    expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
  })

  it('should not route message when topic is missing', async () => {
    await handleMessage(payload, participant, kind, undefined)

    expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
  })

  it('should not route message when kind is missing', async () => {
    await handleMessage(payload, participant, undefined, topic)

    expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
  })

  it('should not route message when received from self', async () => {
    await handleMessage(payload, { ...participant, identity }, kind, topic)

    expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
  })
})
