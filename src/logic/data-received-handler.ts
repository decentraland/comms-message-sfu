import { AppComponents } from '../types'
import { DataPacketKind, RemoteParticipant, Room } from '@livekit/rtc-node'
import { fromLivekitReceivedData } from '../logic/message-routing'

export type IDataReceivedHandler = {
  handleMessage: (
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
  const logger = logs.getLogger('message-handler')

  function handleMessage(room: Room, identity: string) {
    return async (
      payload: Uint8Array<ArrayBufferLike>,
      participant?: RemoteParticipant,
      kind?: DataPacketKind,
      topic?: string
    ) => {
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

      const message = fromLivekitReceivedData(payload, participant, kind, topic)
      await messageRouting.routeMessage(room, message)
    }
  }

  return {
    handleMessage
  }
}
