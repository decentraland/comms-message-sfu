import { AppComponents } from '../../types'

export type IReconnectedHandler = {
  handle: () => void
}

export async function createReconnectedHandler(
  components: Pick<AppComponents, 'logs' | 'metrics'>
): Promise<IReconnectedHandler> {
  const { logs, metrics } = components
  const logger = logs.getLogger('connection-handlers')

  function handle() {
    logger.info('Reconnected to Livekit Server')
    metrics.observe('livekit_connection_status', {}, 1)
  }

  return {
    handle
  }
}
