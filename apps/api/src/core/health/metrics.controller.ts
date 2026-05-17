import { Controller, Get, Header } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { collectDefaultMetrics, Registry } from 'prom-client'
import { Public } from '@sociflow/common'

/**
 * Prometheus metrics endpoint. Public (vì Prometheus scrape) nhưng:
 *   - Nginx config block `/internal/*` không expose path này khi ở `/metrics`
 *   - Trên production deploy, `/metrics` chỉ accessible từ internal network
 *   - Cẩn thận: KHÔNG expose qua public load balancer (Nginx sociflow.conf rule)
 *
 * Default metrics: process_cpu_user_seconds_total, nodejs_heap_size_total_bytes,
 * nodejs_eventloop_lag_seconds, http_request_duration_seconds (qua custom middleware
 * — out of scope V1, có thể add sau).
 */
@ApiExcludeController()
@Controller('/metrics')
export class MetricsController {
  private readonly registry = new Registry()

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'sociflow_api_',
    })
    this.registry.setDefaultLabels({
      app: 'sociflow-api',
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
