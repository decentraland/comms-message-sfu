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
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        logger.warn('Duplicate identity detected, skipping reconnect')
        return
      }

      logger.warn('Disconnected from Livekit room', { reason })
      metrics.observe('livekit_connection_status', {}, 0)

      await reconnect()
    }
  }

  return {
    handle
  }
}
