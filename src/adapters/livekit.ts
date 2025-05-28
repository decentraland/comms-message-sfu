import { IBaseComponent, START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { AppComponents } from '../types'
import { AccessToken } from 'livekit-server-sdk'
import { Room, RoomEvent } from '@livekit/rtc-node'

export type ILivekitComponent = IBaseComponent

export async function createLivekitComponent(
  components: Pick<
    AppComponents,
    | 'config'
    | 'logs'
    | 'dataReceivedHandler'
    | 'connectedHandler'
    | 'disconnectedHandler'
    | 'reconnectingHandler'
    | 'reconnectedHandler'
  >
): Promise<ILivekitComponent> {
  const {
    config,
    logs,
    dataReceivedHandler,
    connectedHandler,
    disconnectedHandler,
    reconnectingHandler,
    reconnectedHandler
  } = components
  const logger = logs.getLogger('livekit')

  const [host, apiKey, apiSecret, roomName, identityPrefix, replicaId] = await Promise.all([
    config.requireString('LIVEKIT_HOST'),
    config.requireString('LIVEKIT_API_KEY'),
    config.requireString('LIVEKIT_API_SECRET'),
    config.requireString('LIVEKIT_ROOM_ID'),
    config.getString('LIVEKIT_IDENTITY_PREFIX'),
    config.getString('REPLICA_NUMBER')
  ])

  const identity = `${identityPrefix || 'message-router'}-${replicaId || '0'}`

  const room = new Room()

  const handleDisconnected = disconnectedHandler.handle(connect)
  const handleDataReceived = dataReceivedHandler.handle(room, identity)

  room
    .on(RoomEvent.Connected, connectedHandler.handle)
    .on(RoomEvent.Reconnecting, reconnectingHandler.handle)
    .on(RoomEvent.Reconnected, reconnectedHandler.handle)
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

  async function disconnect() {
    logger.debug(`Disconnecting identity "${identity}" from Livekit room "${roomName}"`)

    logger.debug('Unsubscribing from Livekit room events')
    room
      .off(RoomEvent.Connected, connectedHandler.handle)
      .off(RoomEvent.Reconnecting, reconnectingHandler.handle)
      .off(RoomEvent.Reconnected, reconnectedHandler.handle)
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
