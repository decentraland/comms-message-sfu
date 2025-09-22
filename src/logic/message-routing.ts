import { AppComponents } from '../types'
import { DataPacketKind, RemoteParticipant, Room } from '@livekit/rtc-node'
import { Packet } from '@dcl/protocol/out-js/decentraland/kernel/comms/rfc4/comms.gen'

export type IncomingMessage = {
  packet: Packet
  from: string
  communityId: string
}

export function fromLivekitReceivedData(
  payload: Uint8Array<ArrayBufferLike>,
  participant: RemoteParticipant,
  _kind: DataPacketKind,
  topic: string
): IncomingMessage {
  try {
    const packet = Packet.decode(payload)
    return {
      packet,
      from: participant.identity,
      communityId: topic.split(':')[1]
    }
  } catch (error) {
    throw new Error(`Failed to decode protobuf packet: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      const { packet, from, communityId } = message

      try {
        if (!room.localParticipant) {
          throw new Error('No local participant available')
        }

        if (packet.message?.$case !== 'chat') {
          throw new Error('Invalid message type')
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

        const encodedPayload = Packet.encode({
          ...packet,
          message: {
            ...packet.message,
            chat: {
              ...packet.message.chat,
              forwardedFrom: from
            }
          }
        }).finish()

        await room.localParticipant.publishData(encodedPayload, {
          destination_identities: communityMembers,
          topic: `community:${communityId}`,
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
