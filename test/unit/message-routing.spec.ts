import { ILoggerComponent, IMetricsComponent } from '@well-known-components/interfaces'
import {
  fromLivekitReceivedData,
  createMessageRouting,
  IncomingMessage,
  IMessageRoutingComponent
} from '../../src/logic/message-routing'
import { IDatabaseComponent } from '../../src/adapters/db'
import { createTestLogsComponent } from '../mocks/components'
import { MockRoom, mockRoom } from '../mocks/livekit'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'

describe('when handling message routing', () => {
  let messageRouting: IMessageRoutingComponent
  let mockDB: jest.Mocked<IDatabaseComponent>
  let mockLogs: jest.Mocked<ILoggerComponent>
  let mockMetrics: jest.Mocked<IMetricsComponent<keyof typeof metricDeclarations>>
  let mockTimer: { end: jest.Mock }

  beforeEach(async () => {
    mockDB = {
      getCommunityMembers: jest.fn()
    }
    mockLogs = createTestLogsComponent()
    mockTimer = { end: jest.fn() }
    mockMetrics = {
      startTimer: jest.fn().mockReturnValue(mockTimer),
      increment: jest.fn(),
      observe: jest.fn()
    } as unknown as jest.Mocked<IMetricsComponent<keyof typeof metricDeclarations>>

    messageRouting = await createMessageRouting({
      db: mockDB,
      logs: mockLogs,
      metrics: mockMetrics
    })
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
    it('should start a timer to record message delivery latency', async () => {
      const message: IncomingMessage = {
        payload: new Uint8Array([1, 2, 3]),
        from: 'test-user',
        communityId: 'test-community'
      }

      await messageRouting.routeMessage(mockRoom as any, message)

      expect(mockMetrics.startTimer).toHaveBeenCalledWith('message_delivery_latency')
    })

    describe('when community has members', () => {
      beforeEach(() => {
        mockDB.getCommunityMembers.mockResolvedValue(['user1', 'user2'])
      })

      describe('when local participant is connected', () => {
        it('should route message and record metrics for successful delivery', async () => {
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

          expect(mockMetrics.startTimer).toHaveBeenCalledWith('message_delivery_latency')
          expect(mockMetrics.increment).toHaveBeenCalledWith('message_delivery_total', { outcome: 'delivered' })
          expect(mockTimer.end).toHaveBeenCalled()
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

        it('should record metrics for failed delivery', async () => {
          const message: IncomingMessage = {
            payload: new Uint8Array([1, 2, 3]),
            from: 'test-user',
            communityId: 'test-community'
          }

          await messageRouting.routeMessage(mockRoomWithLocalParticipant as any, message)

          expect(mockRoom.localParticipant.publishData).not.toHaveBeenCalled()
          expect(mockMetrics.startTimer).toHaveBeenCalledWith('message_delivery_latency')
          expect(mockMetrics.increment).toHaveBeenCalledWith('message_delivery_total', { outcome: 'failed' })
          expect(mockTimer.end).toHaveBeenCalled()
        })
      })
    })

    describe('when community has no members', () => {
      beforeEach(() => {
        mockDB.getCommunityMembers.mockResolvedValue([])
      })

      it('should record metrics for failed delivery', async () => {
        const message: IncomingMessage = {
          payload: new Uint8Array([1, 2, 3]),
          from: 'test-user',
          communityId: 'test-community'
        }

        await messageRouting.routeMessage(mockRoom as any, message)

        expect(mockRoom.localParticipant.publishData).not.toHaveBeenCalled()
        expect(mockMetrics.startTimer).toHaveBeenCalledWith('message_delivery_latency')
        expect(mockMetrics.increment).toHaveBeenCalledWith('message_delivery_total', { outcome: 'failed' })
        expect(mockTimer.end).toHaveBeenCalled()
      })
    })

    describe('when database fails', () => {
      beforeEach(() => {
        mockDB.getCommunityMembers.mockRejectedValue(new Error('DB error'))
      })

      it('should record metrics for failed delivery', async () => {
        const message: IncomingMessage = {
          payload: new Uint8Array([1, 2, 3]),
          from: 'test-user',
          communityId: 'test-community'
        }

        await messageRouting.routeMessage(mockRoom as any, message)

        expect(mockRoom.localParticipant.publishData).not.toHaveBeenCalled()
        expect(mockMetrics.startTimer).toHaveBeenCalledWith('message_delivery_latency')
        expect(mockMetrics.increment).toHaveBeenCalledWith('message_delivery_total', { outcome: 'failed' })
        expect(mockTimer.end).toHaveBeenCalled()
      })
    })
  })
})
