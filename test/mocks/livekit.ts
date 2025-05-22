export type MockRemoteParticipant = {
  identity: string
}

export type MockRoom = {
  connect: jest.Mock
  disconnect: jest.Mock
  on: jest.Mock
  localParticipant: {
    publishData: jest.Mock
  }
}

export const mockRoom: MockRoom = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  localParticipant: {
    publishData: jest.fn()
  }
}
