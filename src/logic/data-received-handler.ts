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
  components: Pick<AppComponents, 'logs' | 'messageRouting' | 'metrics'>
): Promise<IDataReceivedHandler> {
  const { logs, messageRouting } = components
  const logger = logs.getLogger('data-received-handler')

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
      }
    }
  }

  return {
    handle
  }
}
