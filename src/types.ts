import type {
  IConfigComponent,
  ILoggerComponent,
  IHttpServerComponent,
  IBaseComponent,
  IMetricsComponent,
  IFetchComponent
} from '@well-known-components/interfaces'
import { metricDeclarations } from './metrics'
import { IPgComponent } from '@well-known-components/pg-component'
import { IDatabaseComponent } from './adapters/db'
import { ILivekitComponent } from './adapters/livekit'
import { IMessageRoutingComponent } from './logic/message-routing'
import { IDataReceivedHandler } from './logic/data-received-handler'
import { IReconnectedHandler } from './logic/connection-handlers/reconnected'
import { IConnectedHandler } from './logic/connection-handlers/connected'
import { IDisconnectedHandler } from './logic/connection-handlers/disconnected'
import { IReconnectingHandler } from './logic/connection-handlers/reconnecting'

export type GlobalContext = {
  components: BaseComponents
}

// components used in every environment
export type BaseComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  server: IHttpServerComponent<GlobalContext>
  metrics: IMetricsComponent<keyof typeof metricDeclarations>
}

// components used in runtime
export type AppComponents = BaseComponents & {
  statusChecks: IBaseComponent
  pg: IPgComponent
  db: IDatabaseComponent
  livekit: ILivekitComponent
  messageRouting: IMessageRoutingComponent
  dataReceivedHandler: IDataReceivedHandler
  connectedHandler: IConnectedHandler
  disconnectedHandler: IDisconnectedHandler
  reconnectingHandler: IReconnectingHandler
  reconnectedHandler: IReconnectedHandler
}

// components used in tests
export type TestComponents = BaseComponents & {
  // A fetch component that only hits the test server
  localFetch: IFetchComponent
}

// this type simplifies the typings of http handlers
export type HandlerContextWithPath<
  ComponentNames extends keyof AppComponents,
  Path extends string = any
> = IHttpServerComponent.PathAwareContext<
  IHttpServerComponent.DefaultContext<{
    components: Pick<AppComponents, ComponentNames>
  }>,
  Path
>

export type Context<Path extends string = any> = IHttpServerComponent.PathAwareContext<GlobalContext, Path>
