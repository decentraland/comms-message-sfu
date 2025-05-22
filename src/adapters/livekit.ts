import { IBaseComponent, START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { AppComponents } from '../types'
import { AccessToken } from 'livekit-server-sdk'
import { DisconnectReason, Room, RoomEvent } from '@livekit/rtc-node'

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

  const handleDataReceived = dataReceivedHandler.handleMessage(room, identity)

  room
    .on(RoomEvent.Connected, handleConnected)
    .on(RoomEvent.Reconnecting, handleReconnecting)
    .on(RoomEvent.Reconnected, handleReconnected)
    .on(RoomEvent.Disconnected, handleDisconnected)
    .on(RoomEvent.DataReceived, handleDataReceived)

  async function connect() {
    logger.debug(`Connecting identity "${identity}" to Livekit room "${roomName}"`)
    const token = await getToken()
    await room.connect(host, token)
    logger.debug('Connected to Livekit room')
  }

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

  function handleConnected() {
    logger.info('Connected to Livekit room')
    metrics.observe('livekit_connection_status', {}, 1)
  }

  function handleReconnecting() {
    logger.warn('Reconnecting to Livekit room')
    metrics.observe('livekit_connection_status', {}, 0)
  }

  function handleReconnected() {
    logger.info('Reconnected to Livekit room')
    metrics.observe('livekit_connection_status', {}, 1)
  }

  async function handleDisconnected(reason: DisconnectReason) {
    logger.warn('Disconnected from Livekit room', { reason })
    metrics.observe('livekit_connection_status', {}, 0)

    await connect()
  }

  async function disconnect() {
    logger.debug(`Disconnecting identity "${identity}" from Livekit room "${roomName}"`)

    logger.debug('Unsubscribing from Livekit room events')
    room
      .off(RoomEvent.Connected, handleConnected)
      .off(RoomEvent.Reconnecting, handleReconnecting)
      .off(RoomEvent.Reconnected, handleReconnected)
      .off(RoomEvent.Disconnected, handleDisconnected)
      .off(RoomEvent.DataReceived, handleDataReceived)

    await room.disconnect()
    logger.debug('Disconnected from Livekit room')
  }

  return {
    [START_COMPONENT]: connect,
    [STOP_COMPONENT]: disconnect
  }
}
