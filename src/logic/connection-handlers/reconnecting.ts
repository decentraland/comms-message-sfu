import { AppComponents } from '../../types'

export type IReconnectingHandler = {
  handle: () => void
}

export async function createReconnectingHandler(
  components: Pick<AppComponents, 'logs' | 'metrics'>
): Promise<IReconnectingHandler> {
  const { logs, metrics } = components
  const logger = logs.getLogger('connection-handlers')

  function handle() {
    logger.warn('Reconnecting to Livekit Server')
    metrics.observe('livekit_connection_status', {}, 0)
  }

  return {
    handle
  }
}
