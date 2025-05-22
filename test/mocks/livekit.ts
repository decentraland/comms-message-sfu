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

export enum MockDisconnectionReason {}

export type MockRoom = {
  connect: jest.Mock
  disconnect: jest.Mock
  on: jest.Mock
  off: jest.Mock
  localParticipant: {
    publishData: jest.Mock
  }
}

export const mockRoom: MockRoom = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn().mockReturnThis(),
  off: jest.fn().mockReturnThis(),
  localParticipant: {
    publishData: jest.fn()
  }
}
