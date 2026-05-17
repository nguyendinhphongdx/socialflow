import { Controller, Get, Header } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { collectDefaultMetrics, Registry } from 'prom-client'
import { Public } from '@sociflow/common'

/**
 * Prometheus metrics endpoint cho apps/ai. Mirror pattern apps/api.
 *   - Public (Prometheus scrape) nhưng KHÔNG expose qua public load balancer.
 *   - Prefix `sociflow_ai_` để phân biệt với metrics của apps/api (`sociflow_api_`).
 *   - Default metrics: process_cpu_user_seconds_total, nodejs_heap_size_total_bytes,
 *     nodejs_eventloop_lag_seconds.
 */
@ApiExcludeController()
@Controller('/metrics')
export class MetricsController {
  private readonly registry = new Registry()

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'sociflow_ai_',
    })
    this.registry.setDefaultLabels({
      app: 'sociflow-ai',
      env: process.env.NODE_ENV ?? 'development',
    })
  }

  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Get()
  async getMetrics(): Promise<string> {
    return this.registry.metrics()
  }
}
