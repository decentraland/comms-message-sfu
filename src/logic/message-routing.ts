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
  components: Pick<AppComponents, 'db' | 'logs'>
): Promise<IMessageRoutingComponent> {
  const { db, logs } = components
  const logger = logs.getLogger('message-routing')

  return {
    async routeMessage(room: Room, message: IncomingMessage) {
      const { payload, from, communityId } = message

      try {
        const communityMembers = await db.getCommunityMembers(communityId, {
          // TODO(enhancement): include: [online users],
          exclude: [from]
        })

        if (communityMembers.length === 0) {
          logger.warn('No community members found')
          return
        }

        if (!room.localParticipant) {
          logger.error('No local participant available')
          return
        }

        // Publish to all community members except sender
        await room.localParticipant.publishData(payload, {
          destination_identities: communityMembers,
          topic: communityId
        })
      } catch (error: any) {
        logger.error('Error routing message', { error: error.message, communityId, from })
        return
      }
    }
  }
}
