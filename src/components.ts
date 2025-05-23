import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
  instrumentHttpServerWithPromClientRegistry
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import { AppComponents, GlobalContext } from './types'
import { metricDeclarations } from './metrics'
import { createPgComponent } from '@well-known-components/pg-component'
import { createDBComponent } from './adapters/db'
import { createLivekitComponent } from './adapters/livekit'
import { createMessageRouting } from './logic/message-routing'
import { createDataReceivedHandler } from './logic/data-received-handler'
import { createConnectedHandler } from './logic/connection-handlers/connected'
import { createDisconnectedHandler } from './logic/connection-handlers/disconnected'
import { createReconnectingHandler } from './logic/connection-handlers/reconnecting'
import { createReconnectedHandler } from './logic/connection-handlers/reconnected'

export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({ path: ['.env.default', '.env'] })
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const logs = await createLogComponent({ metrics })
  const server = await createServerComponent<GlobalContext>({ config, logs }, {})
  const statusChecks = await createStatusCheckComponent({ server, config })

  await instrumentHttpServerWithPromClientRegistry({ metrics, server, config, registry: metrics.registry! })

  let databaseUrl: string | undefined = await config.getString('PG_COMPONENT_PSQL_CONNECTION_STRING')
  if (!databaseUrl) {
    const dbUser = await config.requireString('PG_COMPONENT_PSQL_USER')
    const dbDatabaseName = await config.requireString('PG_COMPONENT_PSQL_DATABASE')
    const dbPort = await config.requireString('PG_COMPONENT_PSQL_PORT')
    const dbHost = await config.requireString('PG_COMPONENT_PSQL_HOST')
    const dbPassword = await config.requireString('PG_COMPONENT_PSQL_PASSWORD')
    databaseUrl = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbDatabaseName}`
  }

  const pg = await createPgComponent({ logs, config, metrics })
  const db = await createDBComponent({ pg })

  const messageRouting = await createMessageRouting({ db, logs, metrics })
  const dataReceivedHandler = await createDataReceivedHandler({ logs, messageRouting, metrics })
  const connectedHandler = await createConnectedHandler({ logs, metrics })
  const reconnectingHandler = await createReconnectingHandler({ logs, metrics })
  const reconnectedHandler = await createReconnectedHandler({ logs, metrics })
  const disconnectedHandler = await createDisconnectedHandler({ logs, metrics })

  const livekit = await createLivekitComponent({
    config,
    logs,
    dataReceivedHandler,
    connectedHandler,
    disconnectedHandler,
    reconnectingHandler,
    reconnectedHandler
  })

  return {
    config,
    logs,
    server,
    statusChecks,
    metrics,
    pg,
    db,
    livekit,
    messageRouting,
    dataReceivedHandler,
    connectedHandler,
    disconnectedHandler,
    reconnectingHandler,
    reconnectedHandler
  }
}
