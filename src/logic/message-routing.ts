import { AppComponents } from '../types'
import { DataPacketKind, RemoteParticipant, Room } from '@livekit/rtc-node'

export type IncomingMessage = {
  payload: Uint8Array<ArrayBufferLike>
  from: string
  communityId: string
}

export function fromLivekitReceivedData(
  payload: Uint8Array<ArrayBufferLike>,
  participant: RemoteParticipant,
  _kind: DataPacketKind,
  topic: string
): IncomingMessage {
  return {
    payload,
    from: participant.identity,
    communityId: topic
  }
}

export type IMessageRoutingComponent = {
  routeMessage: (room: Room, message: IncomingMessage) => Promise<void>
}

export async function createMessageRouting(
  components: Pick<AppComponents, 'db' | 'logs' | 'metrics'>
): Promise<IMessageRoutingComponent> {
  const { db, logs, metrics } = components
  const logger = logs.getLogger('message-routing')

  return {
    async routeMessage(room: Room, message: IncomingMessage) {
      const messageDeliveryLatencyTimer = metrics.startTimer('message_delivery_latency')
      const { payload, from, communityId } = message

      try {
        const communityMembers = await db.getCommunityMembers(communityId, {
          // TODO(enhancement): include: [online users],
          exclude: [from]
        })

        if (communityMembers.length === 0) {
          throw new Error('No community members found')
        }

        if (!room.localParticipant) {
          throw new Error('No local participant available')
        }

        // Publish to all community members except sender
        await room.localParticipant.publishData(payload, {
          destination_identities: communityMembers,
          topic: communityId
        })

        metrics.increment('message_delivery_total', { outcome: 'delivered' })
      } catch (error: any) {
        logger.error('Error routing message', { error: error.message, communityId, from })
        metrics.increment('message_delivery_total', { outcome: 'failed' })
        return
      } finally {
        messageDeliveryLatencyTimer.end()
      }
    }
  }
}
