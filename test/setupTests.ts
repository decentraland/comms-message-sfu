import { mockRoom } from './mocks/livekit'

// Mock the entire @livekit/rtc-node module to avoid native bindings
jest.mock('@livekit/rtc-node', () => ({
  Room: jest.fn().mockImplementation(() => mockRoom),
  RoomEvent: {
    DataReceived: 'dataReceived',
    Connected: 'connected',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected'
  },
  DataPacketKind: {
    KIND_LOSSY: 1,
    KIND_RELIABLE: 2
  }
}))

beforeEach(() => {
  jest.clearAllMocks()
})
