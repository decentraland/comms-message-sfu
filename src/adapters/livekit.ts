import { IBaseComponent, START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { AppComponents } from '../types'
import { AccessToken } from 'livekit-server-sdk'
import { DataPacketKind, RemoteParticipant, Room, RoomEvent } from '@livekit/rtc-node'

export type ILivekitComponent = IBaseComponent

export async function createLivekitComponent(
  components: Pick<AppComponents, 'config' | 'logs' | 'metrics' | 'dataReceivedHandler'>
): Promise<ILivekitComponent> {
  const { config, logs, metrics, dataReceivedHandler } = components
  const logger = logs.getLogger('livekit')

  const [host, apiKey, apiSecret, roomName, identityPrefix, replicaId] = await Promise.all([
    config.requireString('LIVEKIT_HOST'),
    config.requireString('LIVEKIT_API_KEY'),
    config.requireString('LIVEKIT_API_SECRET'),
    config.requireString('LIVEKIT_ROOM_NAME'),
    config.getString('LIVEKIT_IDENTITY_PREFIX'),
    config.getString('REPLICA_NUMBER')
  ])

  const identity = `${identityPrefix || 'message-router'}-${replicaId || '0'}`

  const room = new Room()

  room.on(RoomEvent.Connected, () => {
    logger.info('Connected to LiveKit room')
    metrics.observe('livekit_connection_status', {}, 1)
  })

  room.on(RoomEvent.Reconnecting, () => {
    logger.warn('Reconnecting to LiveKit room')
    metrics.observe('livekit_connection_status', {}, 0)
  })

  room.on(RoomEvent.Reconnected, () => {
    logger.info('Reconnected to LiveKit room')
    metrics.observe('livekit_connection_status', {}, 1)
  })

  room.on(RoomEvent.Disconnected, (reason) => {
    logger.warn('Disconnected from LiveKit room', { reason })
    metrics.observe('livekit_connection_status', {}, 0)
  })

  room.on(RoomEvent.DataReceived, dataReceivedHandler.handleMessage(room, identity))

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
