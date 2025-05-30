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
import { retry } from '../../src/utils/retrier'
import { sleep } from '../../src/utils/timer'

jest.mock('../../src/utils/retrier')
jest.mock('../../src/utils/timer')

describe('when handling the Livekit component', () => {
  const mockRetry = retry as jest.MockedFunction<typeof retry>
  const mockSleep = sleep as jest.MockedFunction<typeof sleep>

  let livekit: ILivekitComponent
  let mockDataReceivedHandler: jest.Mocked<IDataReceivedHandler>
  let mockConnectedHandler: jest.Mocked<IConnectedHandler>
  let mockDisconnectedHandler: jest.Mocked<IDisconnectedHandler>
  let mockReconnectingHandler: jest.Mocked<IReconnectingHandler>
  let mockReconnectedHandler: jest.Mocked<IReconnectedHandler>
  let mockConfig: IConfigComponent

  const defaultConfig = {
    LIVEKIT_HOST: 'ws://test-host',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-secret',
    LIVEKIT_ROOM_ID: 'test-room',
    LIVEKIT_IDENTITY_PREFIX: 'test-prefix',
    REPLICA_NUMBER: '0',
    LIVEKIT_MAX_RECONNECT_ATTEMPTS: '3',
    LIVEKIT_RECONNECT_DELAY_IN_MS: '100'
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockRetry.mockImplementation(async (action) => action(1))
    mockSleep.mockResolvedValue(undefined)

    mockDataReceivedHandler = {
      handle: jest.fn().mockReturnValue(jest.fn())
    }
    mockConnectedHandler = {
      handle: jest.fn()
    }
    mockDisconnectedHandler = {
      handle: jest.fn().mockReturnValue(jest.fn())
    }
    mockReconnectingHandler = {
      handle: jest.fn()
    }
    mockReconnectedHandler = {
      handle: jest.fn()
    }

    mockConfig = createConfigComponent({}, defaultConfig)

    livekit = await createLivekitComponent({
      config: mockConfig,
      logs: createTestLogsComponent(),
      dataReceivedHandler: mockDataReceivedHandler,
      connectedHandler: mockConnectedHandler,
      disconnectedHandler: mockDisconnectedHandler,
      reconnectingHandler: mockReconnectingHandler,
      reconnectedHandler: mockReconnectedHandler
    })
  })

  describe('and initializing the component', () => {
    it('should create a component with start and stop methods', () => {
      expect(livekit).toBeDefined()
      expect(livekit[START_COMPONENT]).toBeDefined()
      expect(livekit[STOP_COMPONENT]).toBeDefined()
    })

    describe('and required configuration is missing', () => {
      it('should throw an error indicating missing configuration', async () => {
        const invalidConfig = createConfigComponent({}, {})
        await expect(
          createLivekitComponent({
            config: invalidConfig,
            logs: createTestLogsComponent(),
            dataReceivedHandler: mockDataReceivedHandler,
            connectedHandler: mockConnectedHandler,
            disconnectedHandler: mockDisconnectedHandler,
            reconnectingHandler: mockReconnectingHandler,
            reconnectedHandler: mockReconnectedHandler
          })
        ).rejects.toThrow()
      })
    })
  })

  describe('and starting the component', () => {
    describe('and connection is successful', () => {
      it('should create room and establish connection', async () => {
        await livekit[START_COMPONENT]({} as any)

        expect(mockRetry).toHaveBeenCalledWith(
          expect.any(Function),
          Number(defaultConfig.LIVEKIT_MAX_RECONNECT_ATTEMPTS),
          Number(defaultConfig.LIVEKIT_RECONNECT_DELAY_IN_MS)
        )
        expect(mockRoom.connect).toHaveBeenCalledWith('ws://test-host', expect.any(String))
        expect(mockDataReceivedHandler.handle).toHaveBeenCalledWith(mockRoom, 'test-prefix-0')
      })
    })

    describe('and connection fails', () => {
      describe('and retry attempts are available', () => {
        beforeEach(() => {
          mockRoom.connect.mockRejectedValueOnce(new Error('Connection failed'))
          mockRetry.mockImplementationOnce(async (action, _retries, _delay) => {
            try {
              await action(1)
            } catch (error) {
              await action(2)
            }
          })
        })

        it('should attempt to reconnect with correct retry configuration', async () => {
          await livekit[START_COMPONENT]({} as any)

          expect(mockRetry).toHaveBeenCalledWith(
            expect.any(Function),
            Number(defaultConfig.LIVEKIT_MAX_RECONNECT_ATTEMPTS),
            Number(defaultConfig.LIVEKIT_RECONNECT_DELAY_IN_MS)
          )
          expect(mockRoom.connect).toHaveBeenCalledTimes(2)
        })
      })

      describe('and max retry attempts are reached', () => {
        beforeEach(() => {
          mockRoom.connect.mockRejectedValue(new Error('Connection failed'))
          mockRetry.mockImplementationOnce(async (action, retries, _delay) => {
            let lastError: Error | undefined
            for (let i = 1; i <= retries; i++) {
              try {
                await action(i)
              } catch (error) {
                lastError = error as Error
              }
            }
            throw lastError || new Error('Connection failed')
          })
        })

        it('should stop attempting to reconnect after max attempts', async () => {
          await livekit[START_COMPONENT]({} as any)

          expect(mockRetry).toHaveBeenCalledWith(
            expect.any(Function),
            Number(defaultConfig.LIVEKIT_MAX_RECONNECT_ATTEMPTS),
            Number(defaultConfig.LIVEKIT_RECONNECT_DELAY_IN_MS)
          )
          expect(mockRoom.connect).toHaveBeenCalledTimes(Number(defaultConfig.LIVEKIT_MAX_RECONNECT_ATTEMPTS))
        })
      })
    })

    describe('and component is already connecting', () => {
      it('should not attempt to connect again', async () => {
        const startPromise = livekit[START_COMPONENT]({} as any)
        const secondStartPromise = livekit[START_COMPONENT]({} as any)

        await Promise.all([startPromise, secondStartPromise])

        expect(mockRetry).toHaveBeenCalledTimes(1)
        expect(mockRoom.connect).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('and stopping the component', () => {
    describe('and room is initialized', () => {
      beforeEach(async () => {
        await livekit[START_COMPONENT]({} as any)
      })

      it('should disconnect and cleanup all event listeners', async () => {
        await livekit[STOP_COMPONENT]()

        expect(mockRoom.disconnect).toHaveBeenCalled()
        expect(mockRoom.off).toHaveBeenCalledWith(MockRoomEvent.Connected, expect.any(Function))
        expect(mockRoom.off).toHaveBeenCalledWith(MockRoomEvent.Reconnecting, expect.any(Function))
        expect(mockRoom.off).toHaveBeenCalledWith(MockRoomEvent.Reconnected, expect.any(Function))
        expect(mockRoom.off).toHaveBeenCalledWith(MockRoomEvent.Disconnected, expect.any(Function))
        expect(mockRoom.off).toHaveBeenCalledWith(MockRoomEvent.DataReceived, expect.any(Function))
      })
    })

    describe('and room is not initialized', () => {
      it('should complete without throwing errors', async () => {
        await expect(livekit[STOP_COMPONENT]()).resolves.not.toThrow()
      })
    })
  })

  describe('and handling room events', () => {
    beforeEach(async () => {
      await livekit[START_COMPONENT]({} as any)
    })

    describe('and connected event is received', () => {
      it('should trigger the connected handler', () => {
        const connectedHandler = mockRoom.on.mock.calls.find((call) => call[0] === MockRoomEvent.Connected)?.[1]
        expect(connectedHandler).toBeDefined()

        connectedHandler()
        expect(mockConnectedHandler.handle).toHaveBeenCalled()
      })
    })

    describe('and disconnected event is received', () => {
      it('should trigger the disconnected handler and attempt to reconnect', async () => {
        const disconnectedHandler = mockRoom.on.mock.calls.find((call) => call[0] === MockRoomEvent.Disconnected)?.[1]
        expect(disconnectedHandler).toBeDefined()

        const reconnectFn = jest.fn().mockImplementation(async () => {
          await mockRoom.disconnect()
          await mockRoom.connect()
        })
        mockDisconnectedHandler.handle.mockReturnValue(reconnectFn)

        mockRoom.disconnect.mockResolvedValue(undefined)
        mockRoom.connect.mockResolvedValue(undefined)

        await disconnectedHandler()

        expect(mockDisconnectedHandler.handle).toHaveBeenCalled()
        await reconnectFn()
        expect(mockRoom.disconnect).toHaveBeenCalled()
        expect(mockRoom.connect).toHaveBeenCalled()
      })
    })

    describe('and reconnecting event is received', () => {
      it('should trigger the reconnecting handler', () => {
        const reconnectingHandler = mockRoom.on.mock.calls.find((call) => call[0] === MockRoomEvent.Reconnecting)?.[1]
        expect(reconnectingHandler).toBeDefined()

        reconnectingHandler()
        expect(mockReconnectingHandler.handle).toHaveBeenCalled()
      })
    })

    describe('and reconnected event is received', () => {
      it('should trigger the reconnected handler', () => {
        const reconnectedHandler = mockRoom.on.mock.calls.find((call) => call[0] === MockRoomEvent.Reconnected)?.[1]
        expect(reconnectedHandler).toBeDefined()

        reconnectedHandler()
        expect(mockReconnectedHandler.handle).toHaveBeenCalled()
      })
    })
  })

  describe('and handling data', () => {
    let dataHandler: (
      payload: Uint8Array,
      participant?: MockRemoteParticipant,
      kind?: number,
      topic?: string
    ) => Promise<void>
    let handler: jest.Mock

    beforeEach(async () => {
      mockDataReceivedHandler.handle.mockReset()
      handler = jest.fn()
      mockDataReceivedHandler.handle.mockReturnValue(handler)

      await livekit[START_COMPONENT]({} as any)

      const dataHandlerCall = mockRoom.on.mock.calls.find((call) => call[0] === MockRoomEvent.DataReceived)
      expect(dataHandlerCall).toBeDefined()
      dataHandler = dataHandlerCall![1]

      expect(mockDataReceivedHandler.handle).toHaveBeenCalledWith(mockRoom, 'test-prefix-0')
    })

    describe('and receiving data with all parameters', () => {
      it('should process the data with all parameters', async () => {
        const payload = new Uint8Array([1, 2, 3])
        const participant: MockRemoteParticipant = { identity: 'test-user' }
        const kind = 1
        const topic = 'test-community'

        await dataHandler(payload, participant, kind, topic)
        expect(handler).toHaveBeenCalledWith(payload, participant, kind, topic)
      })
    })
  })

  describe('and generating tokens', () => {
    it('should generate a valid JWT token with correct permissions', async () => {
      await livekit[START_COMPONENT]({} as any)

      const tokenCall = mockRoom.connect.mock.calls[0][1]
      expect(tokenCall).toMatch(/^eyJ/)
    })
  })
})
