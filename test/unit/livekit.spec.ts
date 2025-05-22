import { START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { createLivekitComponent, ILivekitComponent } from '../../src/adapters/livekit'
import { createTestLogsComponent, createTestMessageRoutingComponent } from '../mocks/components'
import { MockRemoteParticipant, mockRoom } from '../mocks/livekit'
import { IMessageRoutingComponent } from '../../src/logic/message-routing'
import { IConfigComponent } from '@well-known-components/interfaces'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { metricDeclarations } from '../../src/metrics'
import { createTestMetricsComponent } from '@well-known-components/metrics'

describe('when handling Livekit component', () => {
  let livekit: ILivekitComponent
  let mockMessageRouting: jest.Mocked<IMessageRoutingComponent>
  let dataHandler: (
    payload: Uint8Array,
    participant?: MockRemoteParticipant,
    kind?: number,
    topic?: string
  ) => Promise<void>

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks()

    // Set up the data handler capture
    mockRoom.on.mockImplementation((event, handler) => {
      if (event === 'dataReceived') {
        dataHandler = handler
      }
      return mockRoom
    })

    mockMessageRouting = createTestMessageRoutingComponent()

    const mockConfig: IConfigComponent = createConfigComponent(
      {},
      {
        LIVEKIT_HOST: 'ws://test-host',
        LIVEKIT_API_KEY: 'test-key',
        LIVEKIT_API_SECRET: 'test-secret',
        LIVEKIT_ROOM_NAME: 'test-room',
        LIVEKIT_IDENTITY_PREFIX: 'test-prefix',
        REPLICA_ID: '0'
      }
    )

    livekit = await createLivekitComponent({
      config: mockConfig,
      logs: createTestLogsComponent(),
      messageRouting: mockMessageRouting,
      metrics: createTestMetricsComponent(metricDeclarations)
    })

    // Start the component to ensure event handlers are set up
    await livekit[START_COMPONENT]({} as any)
  })

  describe('when starting the component', () => {
    it('should connect to Livekit room', async () => {
      expect(mockRoom.connect).toHaveBeenCalledWith('ws://test-host', expect.any(String))
    })
  })

  describe('when stopping the component', () => {
    it('should disconnect from Livekit room', async () => {
      await livekit[STOP_COMPONENT]()
      expect(mockRoom.disconnect).toHaveBeenCalled()
    })
  })

  describe('when receiving data', () => {
    it('should route message when valid data is received', async () => {
      const payload = new Uint8Array([1, 2, 3])
      const participant: MockRemoteParticipant = { identity: 'test-user' }
      const kind = 1 // KIND_LOSSY
      const topic = 'test-community'

      await dataHandler(payload, participant, kind, topic)

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
      const payload = new Uint8Array([1, 2, 3])
      const kind = 1 // KIND_LOSSY
      const topic = 'test-community'

      await dataHandler(payload, undefined, kind, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })

    it('should not route message when topic is missing', async () => {
      const payload = new Uint8Array([1, 2, 3])
      const participant: MockRemoteParticipant = { identity: 'test-user' }
      const kind = 1 // KIND_LOSSY

      await dataHandler(payload, participant, kind, undefined)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })

    it('should not route message when kind is missing', async () => {
      const payload = new Uint8Array([1, 2, 3])
      const participant: MockRemoteParticipant = { identity: 'test-user' }
      const topic = 'test-community'

      await dataHandler(payload, participant, undefined, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })

    it('should not route message when received from self', async () => {
      const payload = new Uint8Array([1, 2, 3])
      const participant: MockRemoteParticipant = { identity: 'test-prefix-0' }
      const kind = 1 // KIND_LOSSY
      const topic = 'test-community'

      await dataHandler(payload, participant, kind, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })
  })
})
