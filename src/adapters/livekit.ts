import { IBaseComponent, START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { AppComponents } from '../types'
import { AccessToken } from 'livekit-server-sdk'
import { DataPacketKind, RemoteParticipant, Room, RoomEvent } from '@livekit/rtc-node'
import { fromLivekitReceivedData } from '../logic/message-routing'

export type ILivekitComponent = IBaseComponent

export async function createLivekitComponent(
  components: Pick<AppComponents, 'config' | 'logs' | 'messageRouting'>
): Promise<ILivekitComponent> {
  const { config, logs, messageRouting } = components
  const logger = logs.getLogger('livekit')

  const [host, apiKey, apiSecret, roomName, identityPrefix] = await Promise.all([
    config.requireString('LIVEKIT_HOST'),
    config.requireString('LIVEKIT_API_KEY'),
    config.requireString('LIVEKIT_API_SECRET'),
    config.requireString('LIVEKIT_ROOM_NAME'),
    config.getString('LIVEKIT_IDENTITY_PREFIX')
  ])

  const numOfServerReplica = 0
  const identity = `${identityPrefix}-${numOfServerReplica}`

  const room = new Room()

  room.on(RoomEvent.DataReceived, handleDataReceived)

  async function getToken() {
    const token = new AccessToken(apiKey, apiSecret, {
      identity
    })
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      hidden: true
    })
    return token.toJwt()
  }

  async function handleDataReceived(
    payload: Uint8Array<ArrayBufferLike>,
    participant?: RemoteParticipant | undefined,
    kind?: DataPacketKind | undefined,
    topic?: string | undefined
  ) {
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

  return {
    [START_COMPONENT]: async () => {
      logger.debug(`Connecting identity "${identity}" to Livekit room "${roomName}"`)
      const token = await getToken()
      await room.connect(host, token)
      logger.debug('Connected to Livekit room')
    },
    [STOP_COMPONENT]: async () => {
      logger.info(`Disconnecting identity "${identity}" from Livekit room "${roomName}"`)
      await room.disconnect()
      logger.info('Disconnected from Livekit room')
    }
  }
}
