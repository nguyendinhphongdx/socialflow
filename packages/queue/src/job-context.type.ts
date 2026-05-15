/**
 * Context attached vào mọi BullMQ job để propagate qua worker.
 * Producer set tự động từ CLS. Worker restore lại vào CLS khi process.
 */
export interface JobContext {
  userId?: string
  traceId: string
  sessionId?: string
}

/**
 * Job payload wrapper. Mọi job đi qua `@sociflow/queue` đều có shape này.
 */
export interface JobEnvelope<T> {
  __ctx: JobContext
  data: T
}
