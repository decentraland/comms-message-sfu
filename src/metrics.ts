import { IMetricsComponent } from '@well-known-components/interfaces'
import { validateMetricsDeclaration } from '@well-known-components/metrics'
import { getDefaultHttpMetrics } from '@well-known-components/http-server'
import { metricDeclarations as logsMetricsDeclarations } from '@well-known-components/logger'

export const metricDeclarations = {
  ...getDefaultHttpMetrics(),
  ...logsMetricsDeclarations,
  message_delivery_latency: {
    type: IMetricsComponent.HistogramType,
    help: 'Time taken to deliver a message in milliseconds',
    labelNames: []
  },
  message_delivery_total: {
    type: IMetricsComponent.CounterType,
    help: 'Total number of messages processed',
    labelNames: ['outcome'] // delivered, failed
  },
  livekit_connection_status: {
    type: IMetricsComponent.GaugeType,
    help: 'Current connection status to LiveKit (1 = connected, 0 = disconnected)',
    labelNames: []
  }
}

// type assertions
validateMetricsDeclaration(metricDeclarations)
