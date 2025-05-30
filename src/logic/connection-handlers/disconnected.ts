import { AppComponents } from '../../types'
import { DisconnectReason } from '@livekit/rtc-node'

export type IDisconnectedHandler = {
  handle: (reconnect: () => Promise<void>) => (reason: DisconnectReason) => Promise<void>
}

export async function createDisconnectedHandler(
  components: Pick<AppComponents, 'logs' | 'metrics'>
): Promise<IDisconnectedHandler> {
  const { logs, metrics } = components
  const logger = logs.getLogger('connection-handlers')

  function handle(reconnect: () => Promise<void>) {
    return async (reason: DisconnectReason) => {
      // Update metrics regardless of the reason
      metrics.observe('livekit_connection_status', {}, 0)

      switch (reason) {
        case DisconnectReason.CLIENT_INITIATED:
          logger.info('Client initiated disconnect, not attempting to reconnect')
          return

        case DisconnectReason.DUPLICATE_IDENTITY:
          logger.warn('Duplicate identity detected during reconnection attempt', { reason })
          // We don't want to skip reconnect here because this is likely a temporary state
          // during the reconnection process. The room will handle the reconnection internally.
          return

        case DisconnectReason.SERVER_SHUTDOWN:
          logger.warn('Server is shutting down, will attempt to reconnect', { reason })
          await reconnect()
          return

        case DisconnectReason.PARTICIPANT_REMOVED:
          logger.warn('Participant was removed from the room', { reason })
          // If we were removed, we should try to reconnect with a new token
          await reconnect()
          return

        case DisconnectReason.ROOM_DELETED:
          logger.error('Room was deleted, cannot reconnect', { reason })
          return

        case DisconnectReason.STATE_MISMATCH:
          logger.warn('State mismatch detected, will attempt to reconnect', { reason })
          // State mismatch usually means we need a fresh connection
          await reconnect()
          return

        case DisconnectReason.JOIN_FAILURE:
          logger.error('Failed to join the room', { reason })
          // Join failure might be due to invalid token or room issues
          await reconnect()
          return

        case DisconnectReason.MIGRATION:
          logger.info('Server requested migration, will attempt to reconnect', { reason })
          // Migration means we need to connect to a different server
          await reconnect()
          return

        case DisconnectReason.SIGNAL_CLOSE:
          logger.warn('Signal connection closed unexpectedly, will attempt to reconnect', { reason })
          // Signal close usually means we need a fresh connection
          await reconnect()
          return

        case DisconnectReason.ROOM_CLOSED:
          logger.warn('Room was closed due to all participants leaving', { reason })
          // Room closed might be temporary, we can try to reconnect
          await reconnect()
          return

        case DisconnectReason.USER_UNAVAILABLE:
        case DisconnectReason.USER_REJECTED:
        case DisconnectReason.SIP_TRUNK_FAILURE:
          // These are SIP-specific reasons that shouldn't occur in our case
          logger.error('Unexpected SIP-related disconnect reason', { reason })
          return

        case DisconnectReason.UNKNOWN_REASON:
        default:
          logger.warn('Disconnected from Livekit room with unknown reason', { reason })
          // For unknown reasons, we try to reconnect as it might be a temporary issue
          await reconnect()
          return
      }
    }
  }

  return {
    handle
  }
}
