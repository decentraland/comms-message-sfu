// test/unit/data-received-handler.spec.ts

import { createDataReceivedHandler, IDataReceivedHandler } from '../../src/logic/data-received-handler'
import { createTestLogsComponent, createTestMessageRoutingComponent } from '../mocks/components'
import { mockRoom } from '../mocks/livekit'
import { IMessageRoutingComponent } from '../../src/logic/message-routing'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'
import { Chat } from '@dcl/protocol/out-js/decentraland/kernel/comms/rfc4/comms.gen'

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

  const payload = Chat.create({
    message: 'Hello world',
    timestamp: Date.now()
  })
  const encodedPayload = Chat.encode(payload).finish()
  const participant = { identity: 'test-user' }
  const kind = 1 // KIND_LOSSY
  const topic = 'community:test-community'

  it('should route message when valid data is received', async () => {
    await handleMessage(encodedPayload, participant, kind, topic)

    expect(mockMessageRouting.routeMessage).toHaveBeenCalledWith(
      mockRoom,
      expect.objectContaining({
        packet: payload,
        from: 'test-user',
        communityId: 'test-community'
      })
    )
  })

  it('should not route message when participant is missing', async () => {
    await handleMessage(encodedPayload, undefined, kind, topic)

    expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
  })

  it('should not route message when topic is missing', async () => {
    await handleMessage(encodedPayload, participant, kind, undefined)

    expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
  })

  it('should not route message when kind is missing', async () => {
    await handleMessage(encodedPayload, participant, undefined, topic)

    expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
  })

  it('should not route message when received from self', async () => {
    await handleMessage(encodedPayload, { ...participant, identity }, kind, topic)

    expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
  })
})
