// test/unit/data-received-handler.spec.ts

import { createDataReceivedHandler, IDataReceivedHandler } from '../../src/logic/data-received-handler'
import { createTestLogsComponent, createTestMessageRoutingComponent } from '../mocks/components'
import { mockRoom } from '../mocks/livekit'
import { IMessageRoutingComponent } from '../../src/logic/message-routing'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../../src/metrics'
import { Packet } from '@dcl/protocol/out-js/decentraland/kernel/comms/rfc4/comms.gen'
import { ILoggerComponent } from '@well-known-components/interfaces'

describe('when handling data received', () => {
  let dataReceivedHandler: IDataReceivedHandler
  let mockMessageRouting: jest.Mocked<IMessageRoutingComponent>
  let mockLogs: jest.Mocked<ILoggerComponent>

  let handleMessage: (payload: Uint8Array, participant?: any, kind?: number, topic?: string) => Promise<void>

  const identity = 'test-prefix-0'
  const participant = { identity: 'test-user' }
  const kind = 1 // KIND_LOSSY
  const topic = 'community:test-community'

  let payload: Packet
  let encodedPayload: Uint8Array

  beforeEach(async () => {
    mockMessageRouting = createTestMessageRoutingComponent()
    mockLogs = createTestLogsComponent()
    dataReceivedHandler = await createDataReceivedHandler({
      logs: mockLogs,
      messageRouting: mockMessageRouting,
      metrics: createTestMetricsComponent(metricDeclarations)
    })

    handleMessage = dataReceivedHandler.handle(mockRoom as any, identity)

    payload = Packet.create({
      message: {
        $case: 'chat',
        chat: {
          message: 'Hello world',
          timestamp: Date.now()
        }
      }
    })

    encodedPayload = Packet.encode(payload).finish()
  })

  describe('and the received data is valid', () => {
    it('should route message', async () => {
      await handleMessage(encodedPayload, participant, kind, topic)

      expect(mockMessageRouting.routeMessage).toHaveBeenCalledWith(
        mockRoom,
        expect.objectContaining({
          packet: payload,
          from: 'test-user',
          communityId: 'test-community'
        })
      )
    })
  })

  describe('and the received data is invalid', () => {
    let invalidEncodedPayload: Uint8Array
    beforeEach(() => {
      // Create a truncated/corrupted payload that will cause protobuf decode to fail
      const validPayload = Packet.encode(payload).finish()
      // Truncate the payload to make it invalid
      invalidEncodedPayload = validPayload.slice(0, Math.floor(validPayload.length / 2))
    })

    it('should log an error without breaking the flow', async () => {
      await handleMessage(invalidEncodedPayload, participant, kind, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
      expect(mockLogs.getLogger('message-handler').error).toHaveBeenCalledWith('Error routing message', {
        error: expect.stringMatching(/Failed to decode protobuf packet/)
      })
    })
  })

  describe('and the participant is missing', () => {
    it('should not route message', async () => {
      await handleMessage(encodedPayload, undefined, kind, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })
  })

  describe('and the topic is missing', () => {
    it('should not route message', async () => {
      await handleMessage(encodedPayload, participant, kind, undefined)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })
  })

  describe('and the kind is missing', () => {
    it('should not route message', async () => {
      await handleMessage(encodedPayload, participant, undefined, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })
  })

  describe('and the both the sender and receiver are the same', () => {
    it('should not route message', async () => {
      await handleMessage(encodedPayload, { ...participant, identity }, kind, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })
  })
})
