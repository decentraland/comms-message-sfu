import { START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { createLivekitComponent, ILivekitComponent } from '../../src/adapters/livekit'
import { createTestLogsComponent } from '../mocks/components'
import { MockRemoteParticipant, mockRoom } from '../mocks/livekit'
import { IDataReceivedHandler } from '../../src/logic/data-received-handler'
import { IConfigComponent } from '@well-known-components/interfaces'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { metricDeclarations } from '../../src/metrics'
import { createTestMetricsComponent } from '@well-known-components/metrics'

describe('when handling Livekit component', () => {
  let livekit: ILivekitComponent
  let mockDataReceivedHandler: jest.Mocked<IDataReceivedHandler>
  let dataHandler: (
    payload: Uint8Array,
    participant?: MockRemoteParticipant,
    kind?: number,
    topic?: string
  ) => Promise<void>

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create a mock handler function
    const mockHandler = jest.fn()
    mockDataReceivedHandler = {
      handleMessage: jest.fn().mockReturnValue(mockHandler)
    }

    // Set up the data handler capture
    mockRoom.on.mockImplementation((event, handler) => {
      if (event === 'dataReceived') {
        dataHandler = handler
      }
      return mockRoom
    })

    const mockConfig: IConfigComponent = createConfigComponent(
      {},
      {
        LIVEKIT_HOST: 'ws://test-host',
        LIVEKIT_API_KEY: 'test-key',
        LIVEKIT_API_SECRET: 'test-secret',
        LIVEKIT_ROOM_NAME: 'test-room',
        LIVEKIT_IDENTITY_PREFIX: 'test-prefix',
        REPLICA_NUMBER: '0'
      }
    )

    livekit = await createLivekitComponent({
      config: mockConfig,
      logs: createTestLogsComponent(),
      dataReceivedHandler: mockDataReceivedHandler,
      metrics: createTestMetricsComponent(metricDeclarations)
    })

    // Start the component to ensure event handlers are set up
    await livekit[START_COMPONENT]({} as any)

    expect(mockDataReceivedHandler.handleMessage).toHaveBeenCalledWith(mockRoom, 'test-prefix-0')
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
    it('should handle data from Livekit', async () => {
      const payload = new Uint8Array([1, 2, 3])
      const participant: MockRemoteParticipant = { identity: 'test-user' }
      const kind = 1 // KIND_LOSSY
      const topic = 'test-community'

      await dataHandler(payload, participant, kind, topic)

      const handler = mockDataReceivedHandler.handleMessage.mock.results[0].value
      expect(handler).toHaveBeenCalledWith(payload, participant, kind, topic)
    })
  })
})
