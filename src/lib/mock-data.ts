import { format, subMinutes, subHours, subDays } from 'date-fns';
import type { LogEvent, OverviewMetrics, TimeSeriesPoint, TopItem, GeoPoint } from '@/lib/types';

// Seeded random for reproducibility
let seed = 42;
function seededRandom(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return seededRandom() * (max - min) + min;
}

const COUNTRIES = [
  { code: 'CN', name: '中国' }, { code: 'US', name: '美国' }, { code: 'JP', name: '日本' },
  { code: 'DE', name: '德国' }, { code: 'GB', name: '英国' }, { code: 'KR', name: '韩国' },
  { code: 'SG', name: '新加坡' }, { code: 'IN', name: '印度' }, { code: 'BR', name: '巴西' },
  { code: 'RU', name: '俄罗斯' }, { code: 'AU', name: '澳大利亚' }, { code: 'FR', name: '法国' },
  { code: 'CA', name: '加拿大' }, { code: 'ID', name: '印度尼西亚' }, { code: 'TH', name: '泰国' },
];

const HOSTS = ['www.example.com', 'api.example.com', 'cdn.example.com', 'static.example.com', 'app.example.com'];
const PATHS = ['/', '/index.html', '/api/v1/users', '/api/v1/orders', '/api/v1/products', '/static/js/app.js', '/static/css/main.css', '/images/hero.png', '/api/v1/auth/login', '/api/v1/search', '/blog/post-1', '/docs/getting-started', '/api/v2/data', '/health', '/favicon.ico'];
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const CACHE_STATUSES = ['HIT', 'MISS', 'BYPASS', 'EXPIRED', 'STALE', 'UPDATING', 'REVALIDATED'];
const BOT_TAGS = ['normal', 'malicious', 'suspected', 'unrecognized', '-'];
const SEC_ACTIONS = ['allow', 'deny', 'captcha', 'js_challenge', 'rate_limit', 'log', '-'];
const SEC_SOURCES = ['waf', 'ddos', 'bot_management', 'rate_limiting', 'custom_rule', '-'];
const SSL_PROTOCOLS = ['TLSv1.3', 'TLSv1.2', 'TLSv1.1', 'TLSv1', '-'];
const CONTENT_TYPES = ['text/html', 'application/json', 'text/css', 'application/javascript', 'image/png', 'image/jpeg', 'application/octet-stream', 'text/plain', 'font/woff2', '-'];
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  'curl/8.1.2', 'python-requests/2.31.0', 'Go-http-client/2.0', 'Googlebot/2.1',
  'Baiduspider/2.0', 'Mozilla/5.0 (compatible; Bingbot/2.0)', '-',
];
const ISPS = ['China Telecom', 'China Unicom', 'China Mobile', 'AWS', 'Cloudflare', 'Google Cloud', 'Alibaba Cloud', 'Tencent Cloud'];
const ORIGIN_IPS = ['10.0.1.100', '10.0.1.101', '10.0.1.102', '10.0.2.200', '10.0.2.201', '-'];

function generateClientIP(): string {
  return `${randInt(1, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

function generateHash(length: number): string {
  const chars = 'abcdef0123456789';
  return Array.from({ length }, () => chars[Math.floor(seededRandom() * chars.length)]).join('');
}

function generateStatusCode(): number {
  const r = seededRandom();
  if (r < 0.72) return pick([200, 201, 204]);
  if (r < 0.82) return pick([301, 302, 304]);
  if (r < 0.92) return pick([400, 401, 403, 404, 429]);
  return pick([500, 502, 503, 504]);
}

export function generateMockLog(overrides?: Partial<LogEvent>): LogEvent {
  const country = pick(COUNTRIES);
  const hasOrigin = seededRandom() > 0.4;
  const statusCode = generateStatusCode();
  const cacheStatus = pick(CACHE_STATUSES);
  const botTag = seededRandom() > 0.85 ? pick(BOT_TAGS.filter(b => b !== '-')) : '-';
  const secAction = seededRandom() > 0.9 ? pick(SEC_ACTIONS.filter(s => s !== '-' && s !== 'allow')) : '-';

  return {
    id: `log-${Date.now()}-${generateHash(8)}`,
    source_file: `esa-logs/2024/01/15/log-${generateHash(6)}.jsonl`,
    source_etag: generateHash(32),
    ingested_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    event_time: format(subMinutes(new Date(), randInt(0, 1440)), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    site_name: 'example-site',
    client_request_id: generateHash(32),
    client_ip: generateClientIP(),
    client_country_code: country.code,
    client_region_code: `${country.code}-${randInt(1, 50)}`,
    client_asn: `AS${randInt(1000, 65000)}`,
    client_isp: pick(ISPS),
    client_ssl_protocol: pick(SSL_PROTOCOLS),
    bot_tag: botTag,
    request_host: pick(HOSTS),
    request_method: pick(METHODS),
    request_path: pick(PATHS),
    request_uri: pick(PATHS),
    request_query: seededRandom() > 0.5 ? `page=${randInt(1, 100)}&sort=asc` : '-',
    request_scheme: pick(['https', 'http']),
    request_protocol: pick(['HTTP/2', 'HTTP/1.1', 'HTTP/3']),
    request_referer: seededRandom() > 0.6 ? `https://${pick(HOSTS)}/` : '-',
    request_user_agent: pick(USER_AGENTS),
    request_bytes: randInt(100, 50000),
    edge_server_id: `edge-${pick(['bj', 'sh', 'gz', 'hk', 'sg', 'ty', 'la', 'fr'])}-${randInt(1, 50)}`,
    edge_server_ip: `172.${randInt(16, 31)}.${randInt(0, 255)}.${randInt(1, 254)}`,
    edge_cache_status: cacheStatus,
    edge_status_code: statusCode,
    edge_response_bytes: randInt(200, 5000000),
    edge_body_bytes: randInt(100, 4500000),
    edge_content_type: pick(CONTENT_TYPES),
    edge_response_time_ms: randFloat(1, 2000),
    edge_ttfb_ms: randFloat(1, 500),
    origin_ip: hasOrigin ? pick(ORIGIN_IPS.filter(ip => ip !== '-')) : '-',
    origin_status_code: hasOrigin ? generateStatusCode() : -1,
    origin_dns_ms: hasOrigin ? randFloat(1, 200) : -1,
    origin_tcp_ms: hasOrigin ? randFloat(5, 300) : -1,
    origin_tls_ms: hasOrigin && seededRandom() > 0.3 ? randFloat(10, 500) : -1,
    origin_response_ms: hasOrigin ? randFloat(10, 3000) : -1,
    sec_action: secAction,
    sec_rule_id: secAction !== '-' ? String(randInt(1000, 9999)) : '-1',
    sec_source: secAction !== '-' ? pick(SEC_SOURCES.filter(s => s !== '-')) : '-',
    ja3_hash: generateHash(32),
    ja4_hash: generateHash(16),
    tls_hash: generateHash(32),
    raw: '{}',
    ...overrides,
  };
}

export function generateMockLogs(count: number): LogEvent[] {
  seed = 42; // Reset seed
  return Array.from({ length: count }, (_, i) =>
    generateMockLog({
      event_time: format(subMinutes(new Date(), i * 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      id: `log-${Date.now()}-${generateHash(8)}-${i}`,
    })
  );
}

export function generateOverviewMetrics(): OverviewMetrics {
  return {
    total_requests: 1284567,
    peak_qps: 3421,
    avg_qps: 892,
    total_bandwidth_bytes: 45678901234,
    error_4xx_rate: 4.2,
    error_5xx_rate: 0.8,
    cache_hit_rate: 78.5,
    origin_rate: 21.5,
    p50_response_ms: 45,
    p90_response_ms: 180,
    p95_response_ms: 320,
    p99_response_ms: 890,
    p95_ttfb_ms: 120,
    p99_ttfb_ms: 350,
    security_actions: 12453,
    malicious_bot_rate: 2.1,
    suspected_bot_rate: 3.8,
  };
}

export function generateTimeSeries(hours: number, metric: string): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  for (let i = hours; i >= 0; i--) {
    const ts = subHours(new Date(), i);
    const base = metric === 'requests' ? randInt(5000, 15000) : randInt(1000000, 5000000);
    points.push({
      timestamp: format(ts, 'yyyy-MM-dd HH:00'),
      value: base,
      '2xx': metric === 'requests' ? Math.floor(base * 0.75) : 0,
      '3xx': metric === 'requests' ? Math.floor(base * 0.1) : 0,
      '4xx': metric === 'requests' ? Math.floor(base * 0.1) : 0,
      '5xx': metric === 'requests' ? Math.floor(base * 0.05) : 0,
    });
  }
  return points;
}

export function generateTopItems(type: string, count: number = 10): TopItem[] {
  const generators: Record<string, () => string> = {
    path: () => pick(PATHS),
    ip: () => generateClientIP(),
    host: () => pick(HOSTS),
    referer: () => `https://${pick(HOSTS)}/`,
    ua: () => pick(USER_AGENTS),
    country: () => pick(COUNTRIES).name,
    asn: () => `AS${randInt(1000, 65000)}`,
    isp: () => pick(ISPS),
    origin_ip: () => pick(ORIGIN_IPS.filter(ip => ip !== '-')),
  };

  const gen = generators[type] || generators.path;
  const items: TopItem[] = [];
  const seen = new Set<string>();

  while (items.length < count) {
    const name = gen();
    if (seen.has(name)) continue;
    seen.add(name);
    const value = randInt(100, 50000);
    items.push({ name, value, percentage: 0 });
  }

  const total = items.reduce((s, i) => s + i.value, 0);
  items.forEach(i => { i.percentage = parseFloat(((i.value / total) * 100).toFixed(1)); });
  items.sort((a, b) => b.value - a.value);
  return items;
}

export function generateGeoData(): GeoPoint[] {
  return COUNTRIES.map(c => ({
    country: c.name,
    country_code: c.code,
    requests: randInt(1000, 500000),
    bandwidth_bytes: randInt(1000000, 50000000),
    error_rate: randFloat(0.1, 8),
    p95_ms: randFloat(20, 800),
  })).sort((a, b) => b.requests - a.requests);
}

export function generateCacheStatusDistribution(): Record<string, number> {
  return {
    HIT: 623450,
    MISS: 128900,
    BYPASS: 45600,
    EXPIRED: 32100,
    STALE: 12300,
    UPDATING: 8900,
    REVALIDATED: 33217,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function getStatusColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-success';
  if (code >= 300 && code < 400) return 'text-info';
  if (code >= 400 && code < 500) return 'text-warning';
  if (code >= 500) return 'text-destructive';
  return 'text-muted-foreground';
}

export function getCacheStatusColor(status: string): string {
  switch (status) {
    case 'HIT': return 'text-success';
    case 'MISS': return 'text-warning';
    case 'BYPASS': return 'text-info';
    case 'EXPIRED': return 'text-muted-foreground';
    case 'STALE': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}

export function getBotTagColor(tag: string): string {
  switch (tag) {
    case 'normal': return 'text-success';
    case 'malicious': return 'text-destructive';
    case 'suspected': return 'text-warning';
    case 'unrecognized': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}

export function getSecActionColor(action: string): string {
  switch (action) {
    case 'allow': return 'text-success';
    case 'deny': return 'text-destructive';
    case 'captcha': return 'text-warning';
    case 'js_challenge': return 'text-warning';
    case 'rate_limit': return 'text-info';
    default: return 'text-muted-foreground';
  }
}
