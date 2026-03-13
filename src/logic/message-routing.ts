import { AppComponents } from '../types'
import { DataPacketKind, RemoteParticipant, Room } from '@livekit/rtc-node'
import { Packet } from '@dcl/protocol/out-js/decentraland/kernel/comms/rfc4/comms.gen'

const PUBLISH_BATCH_SIZE = 100

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
          exclude: [from]
        })

        if (communityMembers.length === 0) {
          throw new Error('No community members found')
        }

        const connectedParticipantIdentities = new Set(room.remoteParticipants.keys())
        const connectedMembers = communityMembers.filter((member) => connectedParticipantIdentities.has(member))

        logger.info('Filtering community members by connected participants', {
          communityId,
          from,
          totalCommunityMembers: communityMembers.length,
          connectedPeersInRoom: connectedParticipantIdentities.size,
          connectedCommunityMembers: connectedMembers.length,
          droppedOfflineMembers: communityMembers.length - connectedMembers.length
        })

        if (connectedMembers.length === 0) {
          throw new Error(
            `No connected community members found (${communityMembers.length} members in DB, ${connectedParticipantIdentities.size} peers in room)`
          )
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

        const batches = []
        for (let i = 0; i < connectedMembers.length; i += PUBLISH_BATCH_SIZE) {
          batches.push(connectedMembers.slice(i, i + PUBLISH_BATCH_SIZE))
        }

        logger.debug('Publishing message in batches', {
          communityId,
          totalRecipients: connectedMembers.length,
          batchCount: batches.length,
          batchSize: PUBLISH_BATCH_SIZE
        })

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i]
          try {
            await room.localParticipant.publishData(encodedPayload, {
              destination_identities: batch,
              topic: `community:${communityId}`,
              reliable: true
            })

            logger.debug('Batch published successfully', {
              communityId,
              batchIndex: i + 1,
              batchTotal: batches.length,
              recipientsInBatch: batch.length
            })
          } catch (batchError: any) {
            logger.error('Failed to publish batch', {
              communityId,
              batchIndex: i + 1,
              batchTotal: batches.length,
              recipientsInBatch: batch.length,
              error: batchError.message
            })
          }
        }

        logger.info('Message routed successfully', {
          communityId,
          from,
          recipientCount: connectedMembers.length,
          batchCount: batches.length
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
