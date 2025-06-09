import { AppComponents } from '../types'
import { DataPacketKind, RemoteParticipant, Room } from '@livekit/rtc-node'
import { Chat } from '@dcl/protocol/out-js/decentraland/kernel/comms/rfc4/comms.gen'

export type IncomingMessage = {
  chatMessage: Chat
  from: string
  communityId: string
}

export function fromLivekitReceivedData(
  payload: Uint8Array<ArrayBufferLike>,
  participant: RemoteParticipant,
  _kind: DataPacketKind,
  topic: string
): IncomingMessage {
  // TODO(chore): remove log
  console.log('Decoded payload', Chat.decode(payload))
  return {
    chatMessage: Chat.decode(payload),
    from: participant.identity,
    communityId: topic.split(':')[1]
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
      const { chatMessage: payload, from, communityId } = message

      try {
        if (!room.localParticipant) {
          throw new Error('No local participant available')
        }

        const isMember = await db.belongsToCommunity(communityId, from)
        if (!isMember) {
          throw new Error(`User ${from} is not a member of community ${communityId}, skipping message routing`)
        }

        const communityMembers = await db.getCommunityMembers(communityId, {
          // TODO(enhancement): include: [online users],
          exclude: [from]
        })

        if (communityMembers.length === 0) {
          throw new Error('No community members found')
        }

        const encodedPayload = Chat.encode({
          ...payload,
          from
        }).finish()

        await room.localParticipant.publishData(encodedPayload, {
          destination_identities: communityMembers,
          topic: `community:${communityId}:from:${from}`,
          reliable: true
        })

        logger.info(
          `Successfully routed message for community ${communityId} to ${communityMembers.length} community members from user ${from}`
        )

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
