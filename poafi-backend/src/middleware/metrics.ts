import { Request, Response, NextFunction } from 'express';

type Metric = { count: number; errors: number; totalDurationMs: number; maxDurationMs: number };
const metrics = new Map<string, Metric>();
let inFlight = 0;
let totalRequests = 0;

function metricKey(method: string, route: string, statusClass: string): string {
  return method + ' ' + route + ' ' + statusClass;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();
  inFlight += 1;
  res.on('finish', () => {
    inFlight = Math.max(0, inFlight - 1);
    totalRequests += 1;
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const route = (req.route?.path && typeof req.route.path === 'string')
      ? req.baseUrl + req.route.path
      : (req.path.startsWith('/api/health') ? req.path : '/unmatched');
    const statusClass = String(Math.floor(res.statusCode / 100)) + 'xx';
    const key = metricKey(req.method, route, statusClass);
    const current = metrics.get(key) || { count: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0 };
    current.count += 1;
    if (res.statusCode >= 500) current.errors += 1;
    current.totalDurationMs += durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
    metrics.set(key, current);
  });
  next();
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function renderPrometheusMetrics(): string {
  const lines = [
    '# HELP poafi_http_requests_total Completed HTTP requests.',
    '# TYPE poafi_http_requests_total counter',
    '# HELP poafi_http_request_errors_total HTTP responses with status 5xx.',
    '# TYPE poafi_http_request_errors_total counter',
    '# HELP poafi_http_request_duration_ms_sum Total request duration in milliseconds.',
    '# TYPE poafi_http_request_duration_ms_sum counter',
    '# HELP poafi_http_request_duration_ms_max Maximum observed request duration in milliseconds per process.',
    '# TYPE poafi_http_request_duration_ms_max gauge',
    '# HELP poafi_http_requests_in_flight Current in-flight requests.',
    '# TYPE poafi_http_requests_in_flight gauge',
    '# HELP poafi_process_requests_total Requests completed since this process started.',
    '# TYPE poafi_process_requests_total counter',
  ];
  for (const [key, metric] of metrics) {
    const [method, route, status] = key.split(' ');
    const labels = 'method="' + escapeLabel(method) + '",route="' + escapeLabel(route) + '",status_class="' + escapeLabel(status) + '"';
    lines.push('poafi_http_requests_total{' + labels + '} ' + metric.count);
    lines.push('poafi_http_request_errors_total{' + labels + '} ' + metric.errors);
    lines.push('poafi_http_request_duration_ms_sum{' + labels + '} ' + metric.totalDurationMs.toFixed(3));
    lines.push('poafi_http_request_duration_ms_max{' + labels + '} ' + metric.maxDurationMs.toFixed(3));
  }
  lines.push('poafi_http_requests_in_flight ' + inFlight);
  lines.push('poafi_process_requests_total ' + totalRequests);
  return lines.join('\n') + '\n';
}
