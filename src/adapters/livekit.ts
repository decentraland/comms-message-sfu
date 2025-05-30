import { IBaseComponent, START_COMPONENT, STOP_COMPONENT } from '@well-known-components/interfaces'
import { AppComponents } from '../types'
import { AccessToken } from 'livekit-server-sdk'
import { Room, RoomEvent } from '@livekit/rtc-node'
import { retry } from '../utils/retrier'

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

  const [host, apiKey, apiSecret, roomName, identityPrefix, replicaId, maxReconnectAttempts, reconnectDelayInMs] =
    await Promise.all([
      config.requireString('LIVEKIT_HOST'),
      config.requireString('LIVEKIT_API_KEY'),
      config.requireString('LIVEKIT_API_SECRET'),
      config.requireString('LIVEKIT_ROOM_ID'),
      config.getString('LIVEKIT_IDENTITY_PREFIX'),
      config.getString('REPLICA_NUMBER'),
      (await config.getNumber('LIVEKIT_MAX_RECONNECT_ATTEMPTS')) ?? 5,
      (await config.getNumber('LIVEKIT_RECONNECT_DELAY_IN_MS')) ?? 1000
    ])

  const identity = `${identityPrefix || 'message-router'}-${replicaId || '0'}`

  let room: Room | null = null
  let isConnecting = false

  const handleConnected = () => {
    connectedHandler.handle()
  }
  const handleDisconnected = disconnectedHandler.handle(reconnect)
  let handleDataReceived:
    | ((payload: Uint8Array, participant?: any, kind?: number, topic?: string) => Promise<void>)
    | null = null

  async function reconnect() {
    if (room) {
      await disconnect()
      room = await createRoom()
    }
    await connect()
  }

  async function createRoom() {
    const newRoom = new Room()

    handleDataReceived = dataReceivedHandler.handle(newRoom, identity)

    newRoom
      .on(RoomEvent.Connected, handleConnected)
      .on(RoomEvent.Reconnecting, reconnectingHandler.handle)
      .on(RoomEvent.Reconnected, reconnectedHandler.handle)
      .on(RoomEvent.Disconnected, handleDisconnected)
      .on(RoomEvent.DataReceived, handleDataReceived!)

    return newRoom
  }

  async function connect() {
    if (isConnecting) {
      logger.debug('Already attempting to connect, skipping')
      return
    }

    if (!room) {
      logger.error('Room not initialized, skipping')
      return
    }

    try {
      isConnecting = true

      await retry(
        async (attempt) => {
          logger.debug(
            `Connecting identity "${identity}" to Livekit room "${roomName}" (attempt ${attempt}/${maxReconnectAttempts})`
          )
          const token = await getToken()
          await room!.connect(host, token)
          logger.debug('Connected to Livekit room')
        },
        maxReconnectAttempts,
        reconnectDelayInMs
      )
    } catch (error) {
      logger.error('Failed to connect to Livekit room after all retries', { error: String(error) })
    } finally {
      isConnecting = false
    }
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
    if (!room) {
      logger.debug('No room to disconnect from')
      return
    }

    logger.debug(`Disconnecting identity "${identity}" from Livekit room "${roomName}"`)

    logger.debug('Unsubscribing from Livekit room events')

    room
      .off(RoomEvent.Connected, handleConnected)
      .off(RoomEvent.Reconnecting, reconnectingHandler.handle)
      .off(RoomEvent.Reconnected, reconnectedHandler.handle)
      .off(RoomEvent.Disconnected, handleDisconnected)

    if (handleDataReceived) {
      room.off(RoomEvent.DataReceived, handleDataReceived)
    }

    await room.disconnect()

    room = null
    isConnecting = false
    handleDataReceived = null
    logger.debug('Disconnected from Livekit room')
  }

  return {
    [START_COMPONENT]: async () => {
      room = await createRoom()
      await connect()
    },
    [STOP_COMPONENT]: disconnect
  }
}
