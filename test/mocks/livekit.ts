export type MockRemoteParticipant = {
  identity: string
}

export enum MockRoomEvent {
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Reconnected = 'reconnected',
  Disconnected = 'disconnected',
  DataReceived = 'dataReceived'
}

export enum MockDisconnectionReason {
  UNKNOWN_REASON = 0,
  CLIENT_INITIATED = 1,
  DUPLICATE_IDENTITY = 2,
  SERVER_SHUTDOWN = 3,
  PARTICIPANT_REMOVED = 4,
  ROOM_DELETED = 5,
  STATE_MISMATCH = 6,
  JOIN_FAILURE = 7,
  MIGRATION = 8,
  SIGNAL_CLOSE = 9,
  ROOM_CLOSED = 10,
  USER_UNAVAILABLE = 11,
  USER_REJECTED = 12,
  SIP_TRUNK_FAILURE = 13
}

export enum MockConnectionState {
  CONN_DISCONNECTED = 0,
  CONN_CONNECTED = 1,
  CONN_RECONNECTING = 2
}

export type MockRoom = {
  connect: jest.Mock
  disconnect: jest.Mock
  on: jest.Mock
  off: jest.Mock
  localParticipant: {
    publishData: jest.Mock
  }
  connectionState: MockConnectionState
}

export const mockRoom: MockRoom = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn().mockReturnThis(),
  off: jest.fn().mockReturnThis(),
  localParticipant: {
    publishData: jest.fn()
  },
  connectionState: MockConnectionState.CONN_DISCONNECTED
}
