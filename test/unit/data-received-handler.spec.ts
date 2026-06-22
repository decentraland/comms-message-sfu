// test/unit/data-received-handler.spec.ts

import { createDataReceivedHandler, IDataReceivedHandler } from '../../src/logic/data-received-handler'
import {
  createTestConfigComponent,
  createTestLogsComponent,
  createTestMessageRoutingComponent,
  createTestRateLimiterComponent
} from '../mocks/components'
import { mockRoom } from '../mocks/livekit'
import { IMessageRoutingComponent } from '../../src/logic/message-routing'
import { IRateLimiterComponent } from '../../src/adapters/rate-limiter'
import { createTestMetricsComponent } from '@dcl/metrics'
import { metricDeclarations } from '../../src/metrics'
import { Packet } from '@dcl/protocol/out-js/decentraland/kernel/comms/rfc4/comms.gen'
import { IConfigComponent, ILoggerComponent, IMetricsComponent } from '@well-known-components/interfaces'

describe('when handling data received', () => {
  let dataReceivedHandler: IDataReceivedHandler
  let mockMessageRouting: jest.Mocked<IMessageRoutingComponent>
  let mockLogs: jest.Mocked<ILoggerComponent>
  let mockMetrics: IMetricsComponent<keyof typeof metricDeclarations>
  let mockRateLimiter: jest.Mocked<IRateLimiterComponent>
  let mockConfig: jest.Mocked<IConfigComponent>

  let handleMessage: (payload: Uint8Array, participant?: any, kind?: number, topic?: string) => Promise<void>

  const identity = 'test-prefix-0'
  const participant = { identity: 'test-user' }
  const kind = 1 // KIND_LOSSY
  const topic = 'community:test-community'
  const maxPacketSizeInBytes = 8192

  let payload: Packet
  let encodedPayload: Uint8Array

  beforeEach(async () => {
    mockMessageRouting = createTestMessageRoutingComponent()
    mockLogs = createTestLogsComponent()
    mockMetrics = createTestMetricsComponent(metricDeclarations)
    mockRateLimiter = createTestRateLimiterComponent()
    mockConfig = createTestConfigComponent({ MAX_PACKET_SIZE_BYTES: maxPacketSizeInBytes })
    dataReceivedHandler = await createDataReceivedHandler({
      config: mockConfig,
      logs: mockLogs,
      messageRouting: mockMessageRouting,
      metrics: mockMetrics,
      rateLimiter: mockRateLimiter
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

    jest.spyOn(mockMetrics, 'increment')
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

    it('should check the per-participant rate limit using the sender identity', async () => {
      await handleMessage(encodedPayload, participant, kind, topic)

      expect(mockRateLimiter.isAllowed).toHaveBeenCalledWith('test-user')
    })
  })

  describe('and the payload exceeds the maximum allowed size', () => {
    let oversizedPayload: Uint8Array

    beforeEach(() => {
      oversizedPayload = new Uint8Array(maxPacketSizeInBytes + 1)
    })

    it('should not route the message', async () => {
      await handleMessage(oversizedPayload, participant, kind, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })

    it('should not consume a rate limit token', async () => {
      await handleMessage(oversizedPayload, participant, kind, topic)

      expect(mockRateLimiter.isAllowed).not.toHaveBeenCalled()
    })

    it('should record metrics for a rejected oversized delivery', async () => {
      await handleMessage(oversizedPayload, participant, kind, topic)

      expect(mockMetrics.increment).toHaveBeenCalledWith('message_delivery_total', { outcome: 'rejected_oversized' })
    })
  })

  describe('and the participant has exceeded their rate limit', () => {
    beforeEach(() => {
      mockRateLimiter.isAllowed.mockReturnValue(false)
    })

    it('should not route the message', async () => {
      await handleMessage(encodedPayload, participant, kind, topic)

      expect(mockMessageRouting.routeMessage).not.toHaveBeenCalled()
    })

    it('should record metrics for a rate limited delivery', async () => {
      await handleMessage(encodedPayload, participant, kind, topic)

      expect(mockMetrics.increment).toHaveBeenCalledWith('message_delivery_total', { outcome: 'rate_limited' })
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
      expect(mockMetrics.increment).toHaveBeenCalledWith('message_delivery_total', { outcome: 'failed' })
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
