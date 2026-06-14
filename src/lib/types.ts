// ESA Log Analytics Platform — Type Definitions

export interface LogEvent {
  id: string;
  source_file: string;
  source_etag: string;
  ingested_at: string;
  event_time: string;
  site_name: string;
  client_request_id: string;
  client_ip: string;
  client_country_code: string;
  client_region_code: string;
  client_asn: string;
  client_isp: string;
  client_ssl_protocol: string;
  bot_tag: string;
  request_host: string;
  request_method: string;
  request_path: string;
  request_uri: string;
  request_query: string;
  request_scheme: string;
  request_protocol: string;
  request_referer: string;
  request_user_agent: string;
  request_bytes: number;
  edge_server_id: string;
  edge_server_ip: string;
  edge_cache_status: string;
  edge_status_code: number;
  edge_response_bytes: number;
  edge_body_bytes: number;
  edge_content_type: string;
  edge_response_time_ms: number;
  edge_ttfb_ms: number;
  origin_ip: string;
  origin_status_code: number;
  origin_dns_ms: number;
  origin_tcp_ms: number;
  origin_tls_ms: number;
  origin_response_ms: number;
  sec_action: string;
  sec_rule_id: string;
  sec_source: string;
  ja3_hash: string;
  ja4_hash: string;
  tls_hash: string;
  raw: string;
}

export interface IngestionFile {
  object_key: string;
  etag: string;
  size: number;
  last_modified: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'skipped';
  record_count: number;
  error_count: number;
  error_message: string;
  started_at: string;
  finished_at: string;
}

export interface IngestionJob {
  id: string;
  datasource_id: string;
  status: 'running' | 'success' | 'failed' | 'paused';
  message: string;
  batches: number;
  filesProcessed: number;
  recordsIngested: number;
  hasMore: boolean;
  started_at: string;
  updated_at: string;
  finished_at: string;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  endpoint: string;
  bucket: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  prefix: string;
  format: 'jsonl' | 'json' | 'csv' | 'tsv' | 'gzip';
  timezone: string;
  created_at: string;
  updated_at: string;
  last_sync_status: string;
  last_sync_at: string;
  sync_cursor?: string;
  stats?: {
    logs: number;
    files: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  type: string;
  condition: AlertCondition;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration_minutes: number;
  filters?: Record<string, string>;
}

export interface AlertEvent {
  id: string;
  rule_id: string;
  rule_name: string;
  severity: 'critical' | 'warning' | 'info';
  triggered_at: string;
  resolved_at: string | null;
  message: string;
  value: number;
  threshold: number;
  status: 'active' | 'resolved' | 'silenced';
}

export interface SavedView {
  id: string;
  name: string;
  description: string;
  filters: Record<string, string>;
  time_range: string;
  chart_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Metrics & Analytics

export interface OverviewMetrics {
  total_requests: number;
  peak_qps: number;
  avg_qps: number;
  total_bandwidth_bytes: number;
  error_4xx_rate: number;
  error_5xx_rate: number;
  cache_hit_rate: number;
  origin_rate: number;
  p50_response_ms: number;
  p90_response_ms: number;
  p95_response_ms: number;
  p99_response_ms: number;
  p95_ttfb_ms: number;
  p99_ttfb_ms: number;
  security_actions: number;
  malicious_bot_rate: number;
  suspected_bot_rate: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  [key: string]: string | number;
}

export interface TopItem {
  name: string;
  value: number;
  percentage: number;
  [key: string]: string | number;
}

export interface GeoPoint {
  country: string;
  country_code: string;
  requests: number;
  bandwidth_bytes: number;
  error_rate: number;
  p95_ms: number;
}

export interface PerformanceBreakdown {
  edge_avg_ms: number;
  edge_p95_ms: number;
  origin_dns_avg_ms: number;
  origin_tcp_avg_ms: number;
  origin_tls_avg_ms: number;
  origin_response_avg_ms: number;
  slow_paths: TopItem[];
  slow_origins: TopItem[];
}

export interface CacheAnalysis {
  hit_rate: number;
  miss_rate: number;
  bypass_rate: number;
  expired_rate: number;
  status_distribution: Record<string, number>;
  top_miss_paths: TopItem[];
  top_bypass_paths: TopItem[];
  bandwidth_saved_bytes: number;
}

export interface OriginAnalysis {
  total_origin_requests: number;
  origin_rate: number;
  origin_5xx_count: number;
  origin_5xx_rate: number;
  avg_dns_ms: number;
  avg_tcp_ms: number;
  avg_tls_ms: number;
  avg_response_ms: number;
  top_origin_ips: TopItem[];
  slow_requests: TopItem[];
}

export interface SecurityAnalysis {
  total_security_actions: number;
  sec_action_distribution: Record<string, number>;
  sec_source_distribution: Record<string, number>;
  top_rule_ids: TopItem[];
  malicious_bot_count: number;
  suspected_bot_count: number;
  high_frequency_ips: TopItem[];
  suspicious_uas: TopItem[];
}

export interface BotAnalysis {
  total_bots: number;
  bot_rate: number;
  distribution: Record<string, number>;
  top_bot_ips: TopItem[];
  top_bot_uas: TopItem[];
  top_bot_paths: TopItem[];
}

// Query & Filter

export interface LogFilter {
  time_range?: string;
  time_start?: string;
  time_end?: string;
  site_name?: string;
  host?: string;
  path?: string;
  method?: string;
  status_code_group?: string;
  cache_status?: string;
  has_origin?: boolean;
  origin_ip?: string;
  client_ip?: string;
  country_code?: string;
  asn?: string;
  isp?: string;
  bot_tag?: string;
  sec_action?: string;
  sec_source?: string;
  sec_rule_id?: string;
  ja3_hash?: string;
  ja4_hash?: string;
  user_agent_keyword?: string;
  referer?: string;
  request_id?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface SearchResponse {
  logs: LogEvent[];
  total: number;
  page: number;
  page_size: number;
  query_time_ms: number;
}

// Time range presets
export const TIME_RANGES = [
  { label: '最近 5 分钟', value: '5m' },
  { label: '最近 15 分钟', value: '15m' },
  { label: '最近 1 小时', value: '1h' },
  { label: '最近 6 小时', value: '6h' },
  { label: '最近 24 小时', value: '24h' },
  { label: '最近 7 天', value: '7d' },
  { label: '自定义', value: 'custom' },
] as const;

export type TimeRangeValue = (typeof TIME_RANGES)[number]['value'];
