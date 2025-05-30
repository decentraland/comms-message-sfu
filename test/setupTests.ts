import { mockRoom, MockRoomEvent, MockDisconnectionReason, MockConnectionState } from './mocks/livekit'

// Mock the entire @livekit/rtc-node module to avoid native bindings
jest.mock('@livekit/rtc-node', () => ({
  Room: jest.fn().mockImplementation(() => mockRoom),
  RoomEvent: MockRoomEvent,
  DataPacketKind: {
    KIND_LOSSY: 1,
    KIND_RELIABLE: 2
  },
  DisconnectReason: MockDisconnectionReason,
  ConnectionState: MockConnectionState
}))

beforeEach(() => {
  jest.clearAllMocks()
})
