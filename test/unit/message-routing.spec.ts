import { ILoggerComponent } from '@well-known-components/interfaces'
import {
  fromLivekitReceivedData,
  createMessageRouting,
  IncomingMessage,
  IMessageRoutingComponent
} from '../../src/logic/message-routing'
import { IDatabaseComponent } from '../../src/adapters/db'
import { createTestLogsComponent } from '../mocks/components'
import { MockRoom, mockRoom } from '../mocks/livekit'

describe('when handling message routing', () => {
  let messageRouting: IMessageRoutingComponent
  let mockDB: jest.Mocked<IDatabaseComponent>
  let mockLogs: jest.Mocked<ILoggerComponent>

  beforeEach(async () => {
    mockDB = {
      getCommunityMembers: jest.fn()
    }
    mockLogs = createTestLogsComponent()
    messageRouting = await createMessageRouting({ db: mockDB, logs: mockLogs })
  })

  describe('when transforming Livekit data', () => {
    it('should transform Livekit data into an IncomingMessage', () => {
      const payload = new Uint8Array([1, 2, 3])
      const participant = { identity: 'test-user' }
      const kind = 1 // KIND_LOSSY
      const topic = 'test-community'

      const message = fromLivekitReceivedData(payload, participant as any, kind, topic)

      expect(message).toEqual({
        payload,
        from: 'test-user',
        communityId: 'test-community'
      })
    })
  })

  describe('when routing messages', () => {
    describe('when community has members', () => {
      beforeEach(() => {
        mockDB.getCommunityMembers.mockResolvedValue(['user1', 'user2'])
      })

      describe('when local participant is connected', () => {
        it('should route message to all community members except sender', async () => {
          const message: IncomingMessage = {
            payload: new Uint8Array([1, 2, 3]),
            from: 'test-user',
            communityId: 'test-community'
          }

          await messageRouting.routeMessage(mockRoom as any, message)

          expect(mockDB.getCommunityMembers).toHaveBeenCalledWith('test-community', {
            exclude: ['test-user']
          })

          expect(mockRoom.localParticipant.publishData).toHaveBeenCalledWith(message.payload, {
            destination_identities: ['user1', 'user2'],
            topic: 'test-community'
          })
        })
      })

      describe('when local participant is not connected', () => {
        let mockRoomWithLocalParticipant: MockRoom

        beforeEach(() => {
          mockRoomWithLocalParticipant = {
            ...mockRoom,
            localParticipant: undefined
          }
        })

        it('should not route message', async () => {
          const message: IncomingMessage = {
            payload: new Uint8Array([1, 2, 3]),
            from: 'test-user',
            communityId: 'test-community'
          }

          await messageRouting.routeMessage(mockRoomWithLocalParticipant as any, message)

          expect(mockRoom.localParticipant.publishData).not.toHaveBeenCalled()
        })
      })
    })

    describe('when community has no members', () => {
      beforeEach(() => {
        mockDB.getCommunityMembers.mockResolvedValue([])
      })

      it('should not route message', async () => {
        const message: IncomingMessage = {
          payload: new Uint8Array([1, 2, 3]),
          from: 'test-user',
          communityId: 'test-community'
        }

        await messageRouting.routeMessage(mockRoom as any, message)

        expect(mockDB.getCommunityMembers).toHaveBeenCalledWith('test-community', {
          exclude: ['test-user']
        })
        expect(mockRoom.localParticipant.publishData).not.toHaveBeenCalled()
      })
    })

    describe('when database fails', () => {
      beforeEach(() => {
        mockDB.getCommunityMembers.mockRejectedValue(new Error('DB error'))
      })

      it('should log the error and do nothing else', async () => {
        const message: IncomingMessage = {
          payload: new Uint8Array([1, 2, 3]),
          from: 'test-user',
          communityId: 'test-community'
        }

        await messageRouting.routeMessage(mockRoom as any, message)

        expect(mockDB.getCommunityMembers).toHaveBeenCalledWith('test-community', {
          exclude: ['test-user']
        })
        expect(mockRoom.localParticipant.publishData).not.toHaveBeenCalled()
      })
    })
  })
})
