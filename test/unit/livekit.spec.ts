import { START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { createLivekitComponent, ILivekitComponent } from '../../src/adapters/livekit'
import { createTestLogsComponent } from '../mocks/components'
import { MockRemoteParticipant, mockRoom, MockRoomEvent } from '../mocks/livekit'
import { IDataReceivedHandler } from '../../src/logic/data-received-handler'
import { IConfigComponent } from '@well-known-components/interfaces'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import {
  IConnectedHandler,
  IDisconnectedHandler,
  IReconnectingHandler,
  IReconnectedHandler
} from '../../src/logic/connection-handlers'

describe('when handling Livekit component', () => {
  let livekit: ILivekitComponent
  let mockDataReceivedHandler: jest.Mocked<IDataReceivedHandler>
  let mockConnectedHandler: jest.Mocked<IConnectedHandler>
  let mockDisconnectedHandler: jest.Mocked<IDisconnectedHandler>
  let mockReconnectingHandler: jest.Mocked<IReconnectingHandler>
  let mockReconnectedHandler: jest.Mocked<IReconnectedHandler>

  let dataHandler: (
    payload: Uint8Array,
    participant?: MockRemoteParticipant,
    kind?: number,
    topic?: string
  ) => Promise<void>

  beforeEach(async () => {
    // Create a mock handler function
    const mockHandler = jest.fn()
    mockDataReceivedHandler = {
      handle: jest.fn().mockReturnValue(mockHandler)
    }
    mockConnectedHandler = {
      handle: jest.fn()
    }
    mockDisconnectedHandler = {
      handle: jest.fn().mockReturnValue(mockHandler)
    }
    mockReconnectingHandler = {
      handle: jest.fn()
    }
    mockReconnectedHandler = {
      handle: jest.fn()
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
      connectedHandler: mockConnectedHandler,
      disconnectedHandler: mockDisconnectedHandler,
      reconnectingHandler: mockReconnectingHandler,
      reconnectedHandler: mockReconnectedHandler
    })

    expect(mockDataReceivedHandler.handle).toHaveBeenCalledWith(mockRoom, 'test-prefix-0')
    expect(mockDisconnectedHandler.handle).toHaveBeenCalledWith(expect.any(Function))

    Object.values(MockRoomEvent).forEach((event) => {
      expect(mockRoom.on).toHaveBeenCalledWith(event, expect.any(Function))
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

      Object.values(MockRoomEvent).forEach((event) => {
        expect(mockRoom.off).toHaveBeenCalledWith(event, expect.any(Function))
      })
    })
  })

  describe('when receiving data', () => {
    it('should handle data from Livekit', async () => {
      const payload = new Uint8Array([1, 2, 3])
      const participant: MockRemoteParticipant = { identity: 'test-user' }
      const kind = 1 // KIND_LOSSY
      const topic = 'test-community'

      await dataHandler(payload, participant, kind, topic)

      const handler = mockDataReceivedHandler.handle.mock.results[0].value
      expect(handler).toHaveBeenCalledWith(payload, participant, kind, topic)
    })
  })
})
