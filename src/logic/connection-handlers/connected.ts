import { AppComponents } from '../../types'

export type IConnectedHandler = {
  handle: () => void
}

export async function createConnectedHandler(
  components: Pick<AppComponents, 'logs' | 'metrics'>
): Promise<IConnectedHandler> {
  const { logs, metrics } = components
  const logger = logs.getLogger('connection-handlers')

  function handle() {
    logger.info('Connected to Livekit room')
    metrics.observe('livekit_connection_status', {}, 1)
  }

  return {
    handle
  }
}
