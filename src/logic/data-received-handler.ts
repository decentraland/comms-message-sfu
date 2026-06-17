import { AppComponents } from '../types'
import { DataPacketKind, RemoteParticipant, Room } from '@livekit/rtc-node'
import { fromLivekitReceivedData } from '../logic/message-routing'

export type IDataReceivedHandler = {
  handle: (
    room: Room,
    identity: string
  ) => (
    payload: Uint8Array<ArrayBufferLike>,
    participant?: RemoteParticipant,
    kind?: DataPacketKind,
    topic?: string
  ) => Promise<void>
}

export async function createDataReceivedHandler(
  components: Pick<AppComponents, 'config' | 'logs' | 'messageRouting' | 'metrics' | 'rateLimiter'>
): Promise<IDataReceivedHandler> {
  const { config, logs, messageRouting, metrics, rateLimiter } = components
  const logger = logs.getLogger('data-received-handler')

  // Cap incoming payloads before decoding so a participant cannot amplify load with oversized
  // packets. Chat/chatReaction packets are tiny, so the default leaves ample headroom.
  const maxPacketSizeInBytes = (await config.getNumber('MAX_PACKET_SIZE_BYTES')) ?? 8192

  function handle(room: Room, identity: string) {
    return async (
      payload: Uint8Array<ArrayBufferLike>,
      participant?: RemoteParticipant,
      kind?: DataPacketKind,
      topic?: string
    ) => {
      logger.debug('Received data from Livekit room')

      if (!participant) {
        logger.error('No participant provided')
        return
      } else if (participant.identity === identity) {
        logger.warn('Received data from self')
        return
      }

      if (kind === undefined) {
        logger.error('No kind provided')
        return
      }

      if (!topic) {
        logger.error('No community id provided in the topic')
        return
      }

      if (payload.byteLength > maxPacketSizeInBytes) {
        logger.warn('Dropping oversized data packet', {
          from: participant.identity,
          sizeInBytes: payload.byteLength,
          maxPacketSizeInBytes
        })
        metrics.increment('message_delivery_total', { outcome: 'rejected_oversized' })
        return
      }

      if (!rateLimiter.isAllowed(participant.identity)) {
        logger.warn('Rate limit exceeded, dropping data packet', { from: participant.identity })
        metrics.increment('message_delivery_total', { outcome: 'rate_limited' })
        return
      }

      logger.debug('Received data from Livekit room', {
        from: participant.identity,
        kind,
        topic
      })

      try {
        const message = fromLivekitReceivedData(payload, participant, kind, topic)
        await messageRouting.routeMessage(room, message)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error('Error routing message', { error: errorMessage })
        metrics.increment('message_delivery_total', { outcome: 'failed' })
      }
    }
  }

  return {
    handle
  }
}
