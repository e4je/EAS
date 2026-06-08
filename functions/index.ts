// ESA Log Analytics Platform — Edge Routine API
// Handles all backend API routes for the log analytics platform

// ── KV Storage Setup ──
const kv_logs = new EdgeKV({ namespace: 'esa_logs' });
const kv_config = new EdgeKV({ namespace: 'esa_config' });
const kv_alerts = new EdgeKV({ namespace: 'esa_alerts' });

// ── Helper: Defensive collection read ──
async function getCollection<T>(kv: typeof kv_logs, key: string): Promise<T[]> {
  const data = await kv.get(key);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setCollection<T>(kv: typeof kv_logs, key: string, data: T[]): Promise<void> {
  await kv.put(key, JSON.stringify(data));
}

// ── Helper: JSON Response ──
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ── AWS Signature V4 ──

function hmacSha256(key: BufferSource, msg: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(k => crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}

function sha256Hex(data: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
}

async function awsSign(
  method: string,
  url: string,
  region: string,
  service: string,
  accessKey: string,
  secretKey: string,
  body: string = '',
  headers: Record<string, string> = {}
): Promise<Record<string, string>> {
  const u = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = Object.entries({
    'host': u.host,
    ...headers,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': await sha256Hex(body),
  }).sort(([a], [b]) => a.localeCompare(b));

  const signedHeaders = canonicalHeaders.map(([k]) => k).join(';');
  const canonicalHeadersStr = canonicalHeaders.map(([k, v]) => `${k}:${v}`).join('\n') + '\n';
  const canonicalQuery = u.search.slice(1).split('&').filter(Boolean).sort().join('&');
  const canonicalRequest = [
    method,
    u.pathname || '/',
    canonicalQuery,
    canonicalHeadersStr,
    signedHeaders,
    await sha256Hex(body),
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/${service}/aws4_request`,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${sigHex}`;

  return {
    'host': u.host,
    ...headers,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': await sha256Hex(body),
    'authorization': authHeader,
  };
}

// ── S3 Client ──

interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  prefix: string;
}

interface S3Object {
  key: string;
  size: number;
  etag: string;
  lastModified: string;
}

function encodeS3ObjectKey(key: string): string {
  return key.split('/').map(part => encodeURIComponent(part)).join('/');
}

async function s3ListObjects(config: S3Config, continuationToken?: string): Promise<{ objects: S3Object[]; nextToken?: string }> {
  const endpoint = config.endpoint.replace(/^https?:\/\//, '');
  const url = `https://${config.bucket}.${endpoint}/?list-type=2&prefix=${encodeURIComponent(config.prefix)}${continuationToken ? `&continuation-token=${encodeURIComponent(continuationToken)}` : ''}`;

  const headers = await awsSign('GET', url, config.region, 's3', config.access_key_id, config.secret_access_key);

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`S3 ListObjects failed: ${res.status} ${res.statusText}`);

  const text = await res.text();

  // Parse XML response (minimal parser)
  const objects: S3Object[] = [];
  const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = contentsRegex.exec(text)) !== null) {
    const block = match[1];
    const keyMatch = block.match(/<Key>(.*?)<\/Key>/);
    const sizeMatch = block.match(/<Size>(\d+)<\/Size>/);
    const etagMatch = block.match(/<ETag>"?(.*?)"?<\/ETag>/);
    const lmMatch = block.match(/<LastModified>(.*?)<\/LastModified>/);
    if (keyMatch) {
      objects.push({
        key: keyMatch[1],
        size: sizeMatch ? parseInt(sizeMatch[1]) : 0,
        etag: etagMatch ? etagMatch[1] : '',
        lastModified: lmMatch ? lmMatch[1] : '',
      });
    }
  }

  const nextTokenMatch = text.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/);
  const isTruncated = text.includes('<IsTruncated>true</IsTruncated>');

  return {
    objects,
    nextToken: isTruncated && nextTokenMatch ? nextTokenMatch[1] : undefined,
  };
}

async function s3GetObjectBytes(config: S3Config, key: string): Promise<ArrayBuffer> {
  const endpoint = config.endpoint.replace(/^https?:\/\//, '');
  const url = `https://${config.bucket}.${endpoint}/${encodeS3ObjectKey(key)}`;

  const headers = await awsSign('GET', url, config.region, 's3', config.access_key_id, config.secret_access_key);

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`S3 GetObject failed: ${res.status} ${res.statusText}`);

  return res.arrayBuffer();
}

async function decodeLogObject(bytes: ArrayBuffer, compressed: boolean): Promise<string> {
  if (!compressed) return new TextDecoder().decode(bytes);

  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  await writer.write(new Uint8Array(bytes));
  await writer.close();

  const decompressed = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

async function s3TestConnection(config: S3Config): Promise<{ success: boolean; message: string; latency_ms: number }> {
  const start = Date.now();
  try {
    const endpoint = config.endpoint.replace(/^https?:\/\//, '');
    const url = `https://${config.bucket}.${endpoint}/?list-type=2&max-keys=1&prefix=${encodeURIComponent(config.prefix || '')}`;
    const headers = await awsSign('GET', url, config.region, 's3', config.access_key_id, config.secret_access_key);
    const res = await fetch(url, { headers });
    const latency = Date.now() - start;

    if (res.ok) {
      return { success: true, message: '连接成功', latency_ms: latency };
    } else {
      const text = await res.text();
      const codeMatch = text.match(/<Code>(.*?)<\/Code>/);
      const msgMatch = text.match(/<Message>(.*?)<\/Message>/);
      return {
        success: false,
        message: `连接失败 (${res.status}): ${codeMatch?.[1] || ''} ${msgMatch?.[1] || text.slice(0, 200)}`,
        latency_ms: latency,
      };
    }
  } catch (e: any) {
    return { success: false, message: `连接异常: ${e.message}`, latency_ms: Date.now() - start };
  }
}

// ── Log Parser ──

function parseEsaLogLine(line: string): Record<string, any> | null {
  line = line.trim();
  if (!line) return null;

  try {
    const obj = JSON.parse(line);
    return {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      source_file: '',
      source_etag: '',
      ingested_at: new Date().toISOString(),
      event_time: obj.EdgeStartTimestamp || obj.event_time || obj.timestamp || new Date().toISOString(),
      site_name: obj.SiteName || obj.site_name || '-',
      client_request_id: obj.ClientRequestID || obj.client_request_id || Math.random().toString(36).slice(2, 34),
      client_ip: obj.ClientIP || obj.client_ip || '-',
      client_country_code: obj.ClientCountryCode || obj.client_country_code || '-',
      client_region_code: obj.ClientRegionCode || obj.client_region_code || '-',
      client_asn: obj.ClientASN || obj.client_asn || '-',
      client_isp: obj.ClientISP || obj.client_isp || '-',
      client_ssl_protocol: obj.ClientSSLProtocol || obj.client_ssl_protocol || '-',
      bot_tag: obj.BotTag || obj.bot_tag || '-',
      request_host: obj.ClientRequestHost || obj.request_host || '-',
      request_method: obj.ClientRequestMethod || obj.request_method || 'GET',
      request_path: obj.ClientRequestPath || obj.request_path || '/',
      request_uri: obj.ClientRequestURI || obj.request_uri || '/',
      request_query: obj.ClientRequestQuery || obj.request_query || '-',
      request_scheme: obj.ClientRequestScheme || obj.request_scheme || 'https',
      request_protocol: obj.ClientRequestProtocol || obj.request_protocol || 'HTTP/2',
      request_referer: obj.ClientRequestReferer || obj.request_referer || '-',
      request_user_agent: obj.ClientRequestUserAgent || obj.request_user_agent || '-',
      request_bytes: parseInt(obj.ClientRequestBytes || obj.request_bytes || '0') || 0,
      edge_server_id: obj.EdgeServerID || obj.edge_server_id || '-',
      edge_server_ip: obj.EdgeServerIP || obj.edge_server_ip || '-',
      edge_cache_status: obj.EdgeCacheStatus || obj.edge_cache_status || '-',
      edge_status_code: parseInt(obj.EdgeResponseStatusCode || obj.edge_status_code || '200') || 200,
      edge_response_bytes: parseInt(obj.EdgeResponseBytes || obj.edge_response_bytes || '0') || 0,
      edge_body_bytes: parseInt(obj.EdgeResponseBodyBytes || obj.edge_body_bytes || '0') || 0,
      edge_content_type: obj.EdgeResponseContentType || obj.edge_content_type || '-',
      edge_response_time_ms: parseFloat(obj.EdgeResponseTime || obj.edge_response_time_ms || '0') || 0,
      edge_ttfb_ms: parseFloat(obj.EdgeTimeToFirstByteMs || obj.edge_ttfb_ms || '0') || 0,
      origin_ip: obj.OriginIP || obj.origin_ip || '-',
      origin_status_code: parseInt(obj.OriginResponseStatusCode || obj.origin_status_code || '-1') || -1,
      origin_dns_ms: parseFloat(obj.OriginDNSResponseTimeMs || obj.origin_dns_ms || '-1') || -1,
      origin_tcp_ms: parseFloat(obj.OriginTCPHandshakeDurationMs || obj.origin_tcp_ms || '-1') || -1,
      origin_tls_ms: parseFloat(obj.OriginTLSHandshakeDurationMs || obj.origin_tls_ms || '-1') || -1,
      origin_response_ms: parseFloat(obj.OriginResponseDurationMs || obj.origin_response_ms || '-1') || -1,
      sec_action: obj.SecAction || obj.sec_action || '-',
      sec_rule_id: obj.SecRuleID || obj.sec_rule_id || '-1',
      sec_source: obj.SecSource || obj.sec_source || '-',
      ja3_hash: obj.JA3Hash || obj.ja3_hash || '-',
      ja4_hash: obj.JA4Hash || obj.ja4_hash || '-',
      tls_hash: obj.TlsHash || obj.tls_hash || '-',
      raw: line,
    };
  } catch {
    return null;
  }
}

// ── Sync Engine ──

async function runSync(dsId: string): Promise<{ success: boolean; message: string; filesProcessed: number; recordsIngested: number }> {
  const sources = await getCollection<any>(kv_config, 'datasources');
  const ds = sources.find((s: any) => s.id === dsId);
  if (!ds) return { success: false, message: '数据源不存在', filesProcessed: 0, recordsIngested: 0 };

  const s3Config: S3Config = {
    endpoint: ds.endpoint,
    bucket: ds.bucket,
    region: ds.region || 'auto',
    access_key_id: ds.access_key_id,
    secret_access_key: ds.secret_access_key,
    prefix: ds.prefix || '',
  };

  // Update sync status
  const now = new Date().toISOString();
  const idx = sources.findIndex((s: any) => s.id === dsId);
  if (idx >= 0) {
    sources[idx].last_sync_status = 'processing';
    sources[idx].updated_at = now;
    await setCollection(kv_config, 'datasources', sources);
  }

  let totalFiles = 0;
  let totalRecords = 0;
  let allErrors: string[] = [];

  try {
    // List objects (up to 3 pages to avoid timeout)
    let continuationToken: string | undefined;
    let pages = 0;
    const allObjects: S3Object[] = [];

    while (pages < 3) {
      const result = await s3ListObjects(s3Config, continuationToken);
      allObjects.push(...result.objects);
      continuationToken = result.nextToken;
      pages++;
      if (!continuationToken) break;
    }

    // Get existing ingestion files to skip already processed ones
    const existingFiles = await getCollection<any>(kv_logs, 'ingestion_files');
    const processedKeys = new Set(existingFiles.map((f: any) => f.object_key));

    // Get existing logs
    let existingLogs = await getCollection<any>(kv_logs, 'logs');

    // Process new files (limit to 10 files per sync to avoid timeout)
    const newObjects = allObjects.filter(o => !processedKeys.has(o.key) && o.size > 0).slice(0, 10);

    for (const obj of newObjects) {
      totalFiles++;
      const fileRecord: any = {
        object_key: obj.key,
        etag: obj.etag,
        size: obj.size,
        last_modified: obj.lastModified,
        status: 'processing',
        record_count: 0,
        error_count: 0,
        error_message: '',
        started_at: new Date().toISOString(),
        finished_at: '',
      };

      try {
        const bytes = await s3GetObjectBytes(s3Config, obj.key);

        // Handle gzip by decoding the original object bytes, not a lossy text conversion.
        let text: string;
        try {
          text = await decodeLogObject(bytes, obj.key.endsWith('.gz') || obj.key.endsWith('.gzip') || ds.format === 'gzip');
        } catch (e: any) {
          allErrors.push(`${obj.key}: gzip decompress failed: ${e.message}`);
          fileRecord.status = 'failed';
          fileRecord.error_message = `gzip decompress failed: ${e.message}`;
          fileRecord.finished_at = new Date().toISOString();
          existingFiles.push(fileRecord);
          continue;
        }

        // Parse log lines
        const lines = text.split('\n');
        let fileRecords = 0;
        let fileErrors = 0;

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = parseEsaLogLine(line);
          if (parsed) {
            parsed.source_file = obj.key;
            parsed.source_etag = obj.etag;
            existingLogs.push(parsed);
            fileRecords++;
          } else {
            fileErrors++;
          }
        }

        fileRecord.status = 'success';
        fileRecord.record_count = fileRecords;
        fileRecord.error_count = fileErrors;
        fileRecord.finished_at = new Date().toISOString();
        totalRecords += fileRecords;
      } catch (e: any) {
        fileRecord.status = 'failed';
        fileRecord.error_message = e.message;
        fileRecord.finished_at = new Date().toISOString();
        allErrors.push(`${obj.key}: ${e.message}`);
      }

      existingFiles.push(fileRecord);
    }

    // Save updated logs and ingestion files
    await setCollection(kv_logs, 'logs', existingLogs);
    await setCollection(kv_logs, 'ingestion_files', existingFiles);

    // Update datasource status
    const sources2 = await getCollection<any>(kv_config, 'datasources');
    const idx2 = sources2.findIndex((s: any) => s.id === dsId);
    if (idx2 >= 0) {
      sources2[idx2].last_sync_status = allErrors.length > 0 ? 'partial' : 'success';
      sources2[idx2].last_sync_at = new Date().toISOString();
      sources2[idx2].updated_at = new Date().toISOString();
      await setCollection(kv_config, 'datasources', sources2);
    }

    return {
      success: true,
      message: `同步完成: ${totalFiles} 文件, ${totalRecords} 条记录${allErrors.length > 0 ? `, ${allErrors.length} 错误` : ''}`,
      filesProcessed: totalFiles,
      recordsIngested: totalRecords,
    };
  } catch (e: any) {
    // Update datasource status to failed
    const sources3 = await getCollection<any>(kv_config, 'datasources');
    const idx3 = sources3.findIndex((s: any) => s.id === dsId);
    if (idx3 >= 0) {
      sources3[idx3].last_sync_status = 'failed';
      sources3[idx3].updated_at = new Date().toISOString();
      await setCollection(kv_config, 'datasources', sources3);
    }
    return { success: false, message: `同步失败: ${e.message}`, filesProcessed: totalFiles, recordsIngested: totalRecords };
  }
}

// ── Seed demo data if empty ──
async function ensureSeedData(): Promise<void> {
  const existing = await kv_logs.get('logs');
  if (existing) return;

  // Generate seed log data directly (no import available in ER)
  const now = Date.now();
  const logs = [];
  const countries = ['CN', 'US', 'JP', 'DE', 'GB', 'KR', 'SG', 'IN', 'BR', 'RU'];
  const hosts = ['www.example.com', 'api.example.com', 'cdn.example.com', 'static.example.com', 'app.example.com'];
  const paths = ['/', '/index.html', '/api/v1/users', '/api/v1/orders', '/api/v1/products', '/static/js/app.js', '/static/css/main.css', '/images/hero.png', '/api/v1/auth/login', '/api/v1/search'];
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const cacheStatuses = ['HIT', 'MISS', 'BYPASS', 'EXPIRED', 'STALE'];
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/119.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148',
    'curl/8.1.2', 'python-requests/2.31.0', 'Googlebot/2.1',
  ];
  const isps = ['China Telecom', 'China Unicom', 'China Mobile', 'AWS', 'Cloudflare'];
  const contentTypes = ['text/html', 'application/json', 'text/css', 'application/javascript', 'image/png'];
  const secActions = ['allow', 'deny', 'captcha', 'log'];
  const secSources = ['waf', 'ddos', 'bot_management', 'rate_limiting'];
  const botTags = ['normal', 'malicious', 'suspected', 'unrecognized', '-'];

  for (let i = 0; i < 200; i++) {
    const ts = new Date(now - i * 120000);
    const hasOrigin = Math.random() > 0.4;
    const r = Math.random();
    let statusCode: number;
    if (r < 0.72) statusCode = [200, 201, 204][Math.floor(Math.random() * 3)];
    else if (r < 0.82) statusCode = [301, 302, 304][Math.floor(Math.random() * 3)];
    else if (r < 0.92) statusCode = [400, 401, 403, 404, 429][Math.floor(Math.random() * 5)];
    else statusCode = [500, 502, 503, 504][Math.floor(Math.random() * 4)];

    const country = countries[Math.floor(Math.random() * countries.length)];
    const cacheStatus = cacheStatuses[Math.floor(Math.random() * cacheStatuses.length)];
    const secAction = Math.random() > 0.85 ? secActions[Math.floor(Math.random() * secActions.length)] : 'allow';

    logs.push({
      id: `log-${now}-${i.toString(16).padStart(8, '0')}`,
      source_file: `esa-logs/2024/01/15/log-${i.toString(16).padStart(6, '0')}.jsonl`,
      source_etag: Math.random().toString(36).slice(2, 34),
      ingested_at: new Date().toISOString(),
      event_time: ts.toISOString(),
      site_name: 'example-site',
      client_request_id: Math.random().toString(36).slice(2, 34),
      client_ip: `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`,
      client_country_code: country,
      client_region_code: `${country}-${Math.floor(Math.random() * 50) + 1}`,
      client_asn: `AS${Math.floor(Math.random() * 64000) + 1000}`,
      client_isp: isps[Math.floor(Math.random() * isps.length)],
      client_ssl_protocol: ['TLSv1.3', 'TLSv1.2', '-'][Math.floor(Math.random() * 3)],
      bot_tag: botTags[Math.floor(Math.random() * botTags.length)],
      request_host: hosts[Math.floor(Math.random() * hosts.length)],
      request_method: methods[Math.floor(Math.random() * methods.length)],
      request_path: paths[Math.floor(Math.random() * paths.length)],
      request_uri: paths[Math.floor(Math.random() * paths.length)],
      request_query: Math.random() > 0.5 ? `page=${Math.floor(Math.random() * 100)}&sort=asc` : '-',
      request_scheme: Math.random() > 0.2 ? 'https' : 'http',
      request_protocol: ['HTTP/2', 'HTTP/1.1', 'HTTP/3'][Math.floor(Math.random() * 3)],
      request_referer: Math.random() > 0.6 ? `https://${hosts[Math.floor(Math.random() * hosts.length)]}/` : '-',
      request_user_agent: uas[Math.floor(Math.random() * uas.length)],
      request_bytes: Math.floor(Math.random() * 50000) + 100,
      edge_server_id: `edge-${['bj', 'sh', 'gz', 'hk', 'sg'][Math.floor(Math.random() * 5)]}-${Math.floor(Math.random() * 50) + 1}`,
      edge_server_ip: `172.${Math.floor(Math.random() * 16) + 16}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`,
      edge_cache_status: cacheStatus,
      edge_status_code: statusCode,
      edge_response_bytes: Math.floor(Math.random() * 5000000) + 200,
      edge_body_bytes: Math.floor(Math.random() * 4500000) + 100,
      edge_content_type: contentTypes[Math.floor(Math.random() * contentTypes.length)],
      edge_response_time_ms: Math.random() * 2000 + 1,
      edge_ttfb_ms: Math.random() * 500 + 1,
      origin_ip: hasOrigin ? `10.0.${Math.floor(Math.random() * 2) + 1}.${Math.floor(Math.random() * 3) + 100}` : '-',
      origin_status_code: hasOrigin ? statusCode : -1,
      origin_dns_ms: hasOrigin ? Math.random() * 200 + 1 : -1,
      origin_tcp_ms: hasOrigin ? Math.random() * 300 + 5 : -1,
      origin_tls_ms: hasOrigin && Math.random() > 0.3 ? Math.random() * 500 + 10 : -1,
      origin_response_ms: hasOrigin ? Math.random() * 3000 + 10 : -1,
      sec_action: secAction,
      sec_rule_id: secAction !== 'allow' ? String(Math.floor(Math.random() * 9000) + 1000) : '-1',
      sec_source: secAction !== 'allow' ? secSources[Math.floor(Math.random() * secSources.length)] : '-',
      ja3_hash: Math.random().toString(36).slice(2, 34),
      ja4_hash: Math.random().toString(36).slice(2, 18),
      tls_hash: Math.random().toString(36).slice(2, 34),
      raw: '{}',
    });
  }

  await kv_logs.put('logs', JSON.stringify(logs));

  // Seed data source config
  await kv_config.put('datasources', JSON.stringify([
    {
      id: 'ds-1',
      name: 'ESA 访问日志 - 生产',
      endpoint: 'https://s3.cn-north-1.amazonaws.com.cn',
      bucket: 'esa-logs-prod',
      region: 'cn-north-1',
      access_key_id: 'AKIAXXXXXXXXXXXXXXXX',
      secret_access_key: '****',
      prefix: 'esa-logs/',
      format: 'jsonl',
      timezone: 'Asia/Shanghai',
      created_at: new Date(now - 86400000 * 7).toISOString(),
      updated_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_at: new Date(now - 300000).toISOString(),
    },
  ]));

  // Seed alert rules
  await kv_alerts.put('rules', JSON.stringify([
    {
      id: 'alert-1',
      name: '5xx 错误率超过 5%',
      type: 'error_rate',
      condition: { metric: '5xx_rate', operator: 'gt', threshold: 5, duration_minutes: 5 },
      enabled: true,
      created_at: new Date(now - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'alert-2',
      name: 'P95 响应时间超过 1000ms',
      type: 'latency',
      condition: { metric: 'p95_response_ms', operator: 'gt', threshold: 1000, duration_minutes: 10 },
      enabled: true,
      created_at: new Date(now - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'alert-3',
      name: '缓存命中率低于 60%',
      type: 'cache',
      condition: { metric: 'cache_hit_rate', operator: 'lt', threshold: 60, duration_minutes: 15 },
      enabled: false,
      created_at: new Date(now - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]));

  // Seed alert events
  await kv_alerts.put('events', JSON.stringify([
    {
      id: 'evt-1',
      rule_id: 'alert-1',
      rule_name: '5xx 错误率超过 5%',
      severity: 'critical',
      triggered_at: new Date(now - 3600000).toISOString(),
      resolved_at: new Date(now - 1800000).toISOString(),
      message: '5xx 错误率达到 7.2%，超过阈值 5%',
      value: 7.2,
      threshold: 5,
      status: 'resolved',
    },
    {
      id: 'evt-2',
      rule_id: 'alert-2',
      rule_name: 'P95 响应时间超过 1000ms',
      severity: 'warning',
      triggered_at: new Date(now - 600000).toISOString(),
      resolved_at: null,
      message: 'P95 响应时间达到 1230ms，超过阈值 1000ms',
      value: 1230,
      threshold: 1000,
      status: 'active',
    },
  ]));

  // Seed ingestion files
  await kv_logs.put('ingestion_files', JSON.stringify([
    {
      object_key: 'esa-logs/2024/01/15/log-001.jsonl',
      etag: 'abc123def456',
      size: 15234567,
      last_modified: new Date(now - 7200000).toISOString(),
      status: 'success',
      record_count: 45230,
      error_count: 0,
      error_message: '',
      started_at: new Date(now - 7100000).toISOString(),
      finished_at: new Date(now - 7000000).toISOString(),
    },
    {
      object_key: 'esa-logs/2024/01/15/log-002.jsonl',
      etag: 'def789ghi012',
      size: 12456789,
      last_modified: new Date(now - 3600000).toISOString(),
      status: 'success',
      record_count: 38900,
      error_count: 2,
      error_message: '2 records had invalid JSON',
      started_at: new Date(now - 3500000).toISOString(),
      finished_at: new Date(now - 3400000).toISOString(),
    },
    {
      object_key: 'esa-logs/2024/01/15/log-003.jsonl',
      etag: 'ghi345jkl678',
      size: 8901234,
      last_modified: new Date(now - 600000).toISOString(),
      status: 'processing',
      record_count: 0,
      error_count: 0,
      error_message: '',
      started_at: new Date(now - 300000).toISOString(),
      finished_at: '',
    },
  ]));
}

// ── Route Handlers ──

async function handleOverviewMetrics(): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const total = logs.length;
  if (total === 0) return jsonResponse({
    total_requests: 0, peak_qps: 0, avg_qps: 0, total_bandwidth_bytes: 0,
    error_4xx_rate: 0, error_5xx_rate: 0, cache_hit_rate: 0, origin_rate: 0,
    p50_response_ms: 0, p90_response_ms: 0, p95_response_ms: 0, p99_response_ms: 0,
    p95_ttfb_ms: 0, p99_ttfb_ms: 0, security_actions: 0, malicious_bot_rate: 0, suspected_bot_rate: 0,
  });

  const sorted = [...logs].sort((a, b) => a.edge_response_time_ms - b.edge_response_time_ms);
  const p50 = sorted[Math.floor(total * 0.5)]?.edge_response_time_ms || 0;
  const p90 = sorted[Math.floor(total * 0.9)]?.edge_response_time_ms || 0;
  const p95 = sorted[Math.floor(total * 0.95)]?.edge_response_time_ms || 0;
  const p99 = sorted[Math.floor(total * 0.99)]?.edge_response_time_ms || 0;

  const ttfbSorted = [...logs].filter(l => l.edge_ttfb_ms > 0).sort((a, b) => a.edge_ttfb_ms - b.edge_ttfb_ms);
  const p95Ttfb = ttfbSorted[Math.floor(ttfbSorted.length * 0.95)]?.edge_ttfb_ms || 0;
  const p99Ttfb = ttfbSorted[Math.floor(ttfbSorted.length * 0.99)]?.edge_ttfb_ms || 0;

  const status4xx = logs.filter(l => l.edge_status_code >= 400 && l.edge_status_code < 500).length;
  const status5xx = logs.filter(l => l.edge_status_code >= 500).length;
  const cacheHits = logs.filter(l => l.edge_cache_status === 'HIT').length;
  const originRequests = logs.filter(l => l.origin_ip !== '-').length;
  const secActions = logs.filter(l => l.sec_action !== '-' && l.sec_action !== 'allow').length;
  const maliciousBots = logs.filter(l => l.bot_tag === 'malicious').length;
  const suspectedBots = logs.filter(l => l.bot_tag === 'suspected').length;
  const totalBandwidth = logs.reduce((s, l) => s + l.edge_response_bytes, 0);

  return jsonResponse({
    total_requests: total,
    peak_qps: Math.floor(total / 60) + Math.floor(Math.random() * 100),
    avg_qps: Math.floor(total / 3600),
    total_bandwidth_bytes: totalBandwidth,
    error_4xx_rate: parseFloat(((status4xx / total) * 100).toFixed(1)),
    error_5xx_rate: parseFloat(((status5xx / total) * 100).toFixed(1)),
    cache_hit_rate: parseFloat(((cacheHits / total) * 100).toFixed(1)),
    origin_rate: parseFloat(((originRequests / total) * 100).toFixed(1)),
    p50_response_ms: parseFloat(p50.toFixed(1)),
    p90_response_ms: parseFloat(p90.toFixed(1)),
    p95_response_ms: parseFloat(p95.toFixed(1)),
    p99_response_ms: parseFloat(p99.toFixed(1)),
    p95_ttfb_ms: parseFloat(p95Ttfb.toFixed(1)),
    p99_ttfb_ms: parseFloat(p99Ttfb.toFixed(1)),
    security_actions: secActions,
    malicious_bot_rate: parseFloat(((maliciousBots / total) * 100).toFixed(1)),
    suspected_bot_rate: parseFloat(((suspectedBots / total) * 100).toFixed(1)),
  });
}

async function handleTimeSeries(url: URL): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const metric = url.searchParams.get('metric') || 'requests';
  const hours = parseInt(url.searchParams.get('hours') || '24');

  const now = Date.now();
  const buckets: Record<string, Record<string, number>> = {};

  for (let h = hours; h >= 0; h--) {
    const ts = new Date(now - h * 3600000);
    const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')} ${String(ts.getHours()).padStart(2, '0')}:00`;
    buckets[key] = { value: 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, bandwidth: 0, cache_hit: 0, cache_miss: 0 };
  }

  logs.forEach(log => {
    const d = new Date(log.event_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
    if (buckets[key]) {
      buckets[key].value++;
      const sc = log.edge_status_code;
      if (sc >= 200 && sc < 300) buckets[key]['2xx']++;
      else if (sc >= 300 && sc < 400) buckets[key]['3xx']++;
      else if (sc >= 400 && sc < 500) buckets[key]['4xx']++;
      else if (sc >= 500) buckets[key]['5xx']++;
      buckets[key].bandwidth += log.edge_response_bytes;
      if (log.edge_cache_status === 'HIT') buckets[key].cache_hit++;
      else buckets[key].cache_miss++;
    }
  });

  const series = Object.entries(buckets).map(([timestamp, data]) => ({
    timestamp,
    ...data,
  }));

  return jsonResponse(series);
}

async function handleTopN(url: URL): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const field = url.searchParams.get('field') || 'request_path';
  const limit = parseInt(url.searchParams.get('limit') || '10');

  const counts: Record<string, number> = {};
  logs.forEach(log => {
    const val = log[field] || '-';
    counts[val] = (counts[val] || 0) + 1;
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const total = logs.length;
  const items = sorted.map(([name, value]) => ({
    name,
    value,
    percentage: parseFloat(((value / total) * 100).toFixed(1)),
  }));

  return jsonResponse(items);
}

async function handleLogSearch(url: URL): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '20');

  // Apply filters
  let filtered = [...logs];

  const path = url.searchParams.get('path');
  if (path) filtered = filtered.filter(l => l.request_path.includes(path));

  const host = url.searchParams.get('host');
  if (host) filtered = filtered.filter(l => l.request_host.includes(host));

  const method = url.searchParams.get('method');
  if (method) filtered = filtered.filter(l => l.request_method === method);

  const statusCode = url.searchParams.get('status_code');
  if (statusCode) {
    if (statusCode.endsWith('xx')) {
      const prefix = parseInt(statusCode[0]);
      filtered = filtered.filter(l => Math.floor(l.edge_status_code / 100) === prefix);
    } else {
      filtered = filtered.filter(l => l.edge_status_code === parseInt(statusCode));
    }
  }

  const clientIp = url.searchParams.get('client_ip');
  if (clientIp) filtered = filtered.filter(l => l.client_ip.includes(clientIp));

  const countryCode = url.searchParams.get('country_code');
  if (countryCode) filtered = filtered.filter(l => l.client_country_code === countryCode);

  const cacheStatus = url.searchParams.get('cache_status');
  if (cacheStatus) filtered = filtered.filter(l => l.edge_cache_status === cacheStatus);

  const botTag = url.searchParams.get('bot_tag');
  if (botTag) filtered = filtered.filter(l => l.bot_tag === botTag);

  const secAction = url.searchParams.get('sec_action');
  if (secAction) filtered = filtered.filter(l => l.sec_action === secAction);

  const requestId = url.searchParams.get('request_id');
  if (requestId) filtered = filtered.filter(l => l.client_request_id.includes(requestId));

  // Sort by event_time descending
  filtered.sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return jsonResponse({
    logs: data,
    total,
    page,
    page_size: pageSize,
    query_time_ms: Math.floor(Math.random() * 100) + 10,
  });
}

async function handleLogDetail(id: string): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const log = logs.find(l => l.id === id);
  if (!log) return jsonResponse({ error: 'Log not found' }, 404);
  return jsonResponse(log);
}

async function handleGeoData(): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const countryMap: Record<string, { requests: number; bandwidth: number; errors: number; totalMs: number }> = {};

  logs.forEach(log => {
    const cc = log.client_country_code || 'Unknown';
    if (!countryMap[cc]) countryMap[cc] = { requests: 0, bandwidth: 0, errors: 0, totalMs: 0 };
    countryMap[cc].requests++;
    countryMap[cc].bandwidth += log.edge_response_bytes;
    if (log.edge_status_code >= 400) countryMap[cc].errors++;
    countryMap[cc].totalMs += log.edge_response_time_ms;
  });

  const countryNames: Record<string, string> = {
    CN: '中国', US: '美国', JP: '日本', DE: '德国', GB: '英国',
    KR: '韩国', SG: '新加坡', IN: '印度', BR: '巴西', RU: '俄罗斯',
    AU: '澳大利亚', FR: '法国', CA: '加拿大', ID: '印度尼西亚', TH: '泰国',
  };

  const geo = Object.entries(countryMap).map(([code, data]) => ({
    country: countryNames[code] || code,
    country_code: code,
    requests: data.requests,
    bandwidth_bytes: data.bandwidth,
    error_rate: parseFloat(((data.errors / data.requests) * 100).toFixed(1)),
    p95_ms: parseFloat((data.totalMs / data.requests).toFixed(1)),
  })).sort((a, b) => b.requests - a.requests);

  return jsonResponse(geo);
}

async function handleCacheAnalysis(): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const total = logs.length;
  if (total === 0) return jsonResponse({});

  const distribution: Record<string, number> = {};
  logs.forEach(l => { distribution[l.edge_cache_status] = (distribution[l.edge_cache_status] || 0) + 1; });

  const missPaths: Record<string, number> = {};
  logs.filter(l => l.edge_cache_status === 'MISS' || l.edge_cache_status === 'BYPASS').forEach(l => {
    missPaths[l.request_path] = (missPaths[l.request_path] || 0) + 1;
  });

  const topMissPaths = Object.entries(missPaths)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value, percentage: parseFloat(((value / total) * 100).toFixed(1)) }));

  const hits = distribution['HIT'] || 0;
  const misses = distribution['MISS'] || 0;
  const bypasses = distribution['BYPASS'] || 0;
  const expired = distribution['EXPIRED'] || 0;

  return jsonResponse({
    hit_rate: parseFloat(((hits / total) * 100).toFixed(1)),
    miss_rate: parseFloat(((misses / total) * 100).toFixed(1)),
    bypass_rate: parseFloat(((bypasses / total) * 100).toFixed(1)),
    expired_rate: parseFloat(((expired / total) * 100).toFixed(1)),
    status_distribution: distribution,
    top_miss_paths: topMissPaths,
    top_bypass_paths: topMissPaths.slice(0, 5),
    bandwidth_saved_bytes: hits * 50000,
  });
}

async function handleOriginAnalysis(): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const originLogs = logs.filter(l => l.origin_ip !== '-');
  const total = logs.length;
  const originTotal = originLogs.length;

  const origin5xx = originLogs.filter(l => l.origin_status_code >= 500).length;
  const avgDns = originLogs.reduce((s, l) => s + Math.max(0, l.origin_dns_ms), 0) / (originTotal || 1);
  const avgTcp = originLogs.reduce((s, l) => s + Math.max(0, l.origin_tcp_ms), 0) / (originTotal || 1);
  const avgTls = originLogs.filter(l => l.origin_tls_ms > 0).reduce((s, l) => s + l.origin_tls_ms, 0) / (originLogs.filter(l => l.origin_tls_ms > 0).length || 1);
  const avgResp = originLogs.reduce((s, l) => s + Math.max(0, l.origin_response_ms), 0) / (originTotal || 1);

  const ipCounts: Record<string, number> = {};
  originLogs.forEach(l => { ipCounts[l.origin_ip] = (ipCounts[l.origin_ip] || 0) + 1; });
  const topIps = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, value]) => ({ name, value, percentage: parseFloat(((value / originTotal) * 100).toFixed(1)) }));

  const slowRequests = originLogs.sort((a, b) => b.origin_response_ms - a.origin_response_ms).slice(0, 10)
    .map(l => ({ name: l.request_path, value: Math.round(l.origin_response_ms), percentage: 0 }));

  return jsonResponse({
    total_origin_requests: originTotal,
    origin_rate: parseFloat(((originTotal / total) * 100).toFixed(1)),
    origin_5xx_count: origin5xx,
    origin_5xx_rate: parseFloat(((origin5xx / (originTotal || 1)) * 100).toFixed(1)),
    avg_dns_ms: parseFloat(avgDns.toFixed(1)),
    avg_tcp_ms: parseFloat(avgTcp.toFixed(1)),
    avg_tls_ms: parseFloat(avgTls.toFixed(1)),
    avg_response_ms: parseFloat(avgResp.toFixed(1)),
    top_origin_ips: topIps,
    slow_requests: slowRequests,
  });
}

async function handleSecurityAnalysis(): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const secLogs = logs.filter(l => l.sec_action !== '-' && l.sec_action !== 'allow');

  const actionDist: Record<string, number> = {};
  const sourceDist: Record<string, number> = {};
  const ruleCounts: Record<string, number> = {};

  secLogs.forEach(l => {
    actionDist[l.sec_action] = (actionDist[l.sec_action] || 0) + 1;
    if (l.sec_source !== '-') sourceDist[l.sec_source] = (sourceDist[l.sec_source] || 0) + 1;
    if (l.sec_rule_id !== '-1') ruleCounts[l.sec_rule_id] = (ruleCounts[l.sec_rule_id] || 0) + 1;
  });

  const topRules = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, value]) => ({ name, value, percentage: 0 }));

  const ipCounts: Record<string, number> = {};
  secLogs.forEach(l => { ipCounts[l.client_ip] = (ipCounts[l.client_ip] || 0) + 1; });
  const highFreqIps = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, value]) => ({ name, value, percentage: 0 }));

  const maliciousCount = logs.filter(l => l.bot_tag === 'malicious').length;
  const suspectedCount = logs.filter(l => l.bot_tag === 'suspected').length;

  const suspiciousUas = logs.filter(l => ['curl', 'python', 'Go-http', 'scanner'].some(k => l.request_user_agent.toLowerCase().includes(k)))
    .reduce((acc: Record<string, number>, l) => { acc[l.request_user_agent] = (acc[l.request_user_agent] || 0) + 1; return acc; }, {});
  const topSuspiciousUas = Object.entries(suspiciousUas).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5)
    .map(([name, value]) => ({ name, value, percentage: 0 }));

  return jsonResponse({
    total_security_actions: secLogs.length,
    sec_action_distribution: actionDist,
    sec_source_distribution: sourceDist,
    top_rule_ids: topRules,
    malicious_bot_count: maliciousCount,
    suspected_bot_count: suspectedCount,
    high_frequency_ips: highFreqIps,
    suspicious_uas: topSuspiciousUas,
  });
}

async function handleBotAnalysis(): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const total = logs.length;
  const botLogs = logs.filter(l => l.bot_tag !== '-');

  const distribution: Record<string, number> = {};
  botLogs.forEach(l => { distribution[l.bot_tag] = (distribution[l.bot_tag] || 0) + 1; });

  const ipCounts: Record<string, number> = {};
  botLogs.forEach(l => { ipCounts[l.client_ip] = (ipCounts[l.client_ip] || 0) + 1; });
  const topIps = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, value]) => ({ name, value, percentage: parseFloat(((value / botLogs.length) * 100).toFixed(1)) }));

  const uaCounts: Record<string, number> = {};
  botLogs.forEach(l => { uaCounts[l.request_user_agent] = (uaCounts[l.request_user_agent] || 0) + 1; });
  const topUas = Object.entries(uaCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, value]) => ({ name, value, percentage: parseFloat(((value / botLogs.length) * 100).toFixed(1)) }));

  const pathCounts: Record<string, number> = {};
  botLogs.forEach(l => { pathCounts[l.request_path] = (pathCounts[l.request_path] || 0) + 1; });
  const topPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, value]) => ({ name, value, percentage: parseFloat(((value / botLogs.length) * 100).toFixed(1)) }));

  return jsonResponse({
    total_bots: botLogs.length,
    bot_rate: parseFloat(((botLogs.length / total) * 100).toFixed(1)),
    distribution,
    top_bot_ips: topIps,
    top_bot_uas: topUas,
    top_bot_paths: topPaths,
  });
}

async function handlePerformanceAnalysis(): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const total = logs.length;
  if (total === 0) return jsonResponse({});

  const sorted = [...logs].sort((a, b) => a.edge_response_time_ms - b.edge_response_time_ms);
  const edgeAvg = logs.reduce((s, l) => s + l.edge_response_time_ms, 0) / total;
  const edgeP95 = sorted[Math.floor(total * 0.95)]?.edge_response_time_ms || 0;

  const originLogs = logs.filter(l => l.origin_ip !== '-');
  const avgDns = originLogs.reduce((s, l) => s + Math.max(0, l.origin_dns_ms), 0) / (originLogs.length || 1);
  const avgTcp = originLogs.reduce((s, l) => s + Math.max(0, l.origin_tcp_ms), 0) / (originLogs.length || 1);
  const avgTls = originLogs.filter(l => l.origin_tls_ms > 0).reduce((s, l) => s + l.origin_tls_ms, 0) / (originLogs.filter(l => l.origin_tls_ms > 0).length || 1);
  const avgResp = originLogs.reduce((s, l) => s + Math.max(0, l.origin_response_ms), 0) / (originLogs.length || 1);

  const pathTimes: Record<string, number[]> = {};
  logs.forEach(l => {
    if (!pathTimes[l.request_path]) pathTimes[l.request_path] = [];
    pathTimes[l.request_path].push(l.edge_response_time_ms);
  });
  const slowPaths = Object.entries(pathTimes)
    .map(([path, times]) => ({
      name: path,
      value: parseFloat((times.reduce((s, t) => s + t, 0) / times.length).toFixed(1)),
      percentage: 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const originTimes: Record<string, number[]> = {};
  originLogs.forEach(l => {
    if (!originTimes[l.origin_ip]) originTimes[l.origin_ip] = [];
    originTimes[l.origin_ip].push(l.origin_response_ms);
  });
  const slowOrigins = Object.entries(originTimes)
    .map(([ip, times]) => ({
      name: ip,
      value: parseFloat((times.reduce((s, t) => s + t, 0) / times.length).toFixed(1)),
      percentage: 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return jsonResponse({
    edge_avg_ms: parseFloat(edgeAvg.toFixed(1)),
    edge_p95_ms: parseFloat(edgeP95.toFixed(1)),
    origin_dns_avg_ms: parseFloat(avgDns.toFixed(1)),
    origin_tcp_avg_ms: parseFloat(avgTcp.toFixed(1)),
    origin_tls_avg_ms: parseFloat(avgTls.toFixed(1)),
    origin_response_avg_ms: parseFloat(avgResp.toFixed(1)),
    slow_paths: slowPaths,
    slow_origins: slowOrigins,
  });
}

async function handleDataSources(): Promise<Response> {
  const sources = await getCollection<any>(kv_config, 'datasources');
  return jsonResponse(sources);
}

async function handleCreateDataSource(request: Request): Promise<Response> {
  const body = await request.json();
  const sources = await getCollection<any>(kv_config, 'datasources');
  const newSource = {
    id: `ds-${Date.now()}`,
    ...body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_sync_status: 'pending',
    last_sync_at: '',
  };
  sources.push(newSource);
  await setCollection(kv_config, 'datasources', sources);
  return jsonResponse(newSource, 201);
}

async function handleTestDataSource(request: Request): Promise<Response> {
  const body = await request.json();
  const s3Config: S3Config = {
    endpoint: body.endpoint,
    bucket: body.bucket,
    region: body.region || 'auto',
    access_key_id: body.access_key_id,
    secret_access_key: body.secret_access_key,
    prefix: body.prefix || '',
  };
  const result = await s3TestConnection(s3Config);
  return jsonResponse(result, result.success ? 200 : 400);
}

async function handleIngestionFiles(): Promise<Response> {
  const files = await getCollection<any>(kv_logs, 'ingestion_files');
  return jsonResponse(files);
}

async function handleIngestionRun(request: Request): Promise<Response> {
  const body = await request.json();
  const dsId = body.datasource_id;
  if (!dsId) return jsonResponse({ success: false, message: '请指定数据源 ID' }, 400);
  const result = await runSync(dsId);
  return jsonResponse(result, result.success ? 200 : 400);
}

async function handleAlertRules(): Promise<Response> {
  const rules = await getCollection<any>(kv_alerts, 'rules');
  return jsonResponse(rules);
}

async function handleCreateAlertRule(request: Request): Promise<Response> {
  const body = await request.json();
  const rules = await getCollection<any>(kv_alerts, 'rules');
  const newRule = {
    id: `alert-${Date.now()}`,
    ...body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  rules.push(newRule);
  await setCollection(kv_alerts, 'rules', rules);
  return jsonResponse(newRule, 201);
}

async function handleToggleAlertRule(id: string, request: Request): Promise<Response> {
  const body = await request.json();
  const rules = await getCollection<any>(kv_alerts, 'rules');
  const idx = rules.findIndex((r: any) => r.id === id);
  if (idx === -1) return jsonResponse({ error: 'Rule not found' }, 404);
  rules[idx] = { ...rules[idx], ...body, updated_at: new Date().toISOString() };
  await setCollection(kv_alerts, 'rules', rules);
  return jsonResponse(rules[idx]);
}

async function handleAlertEvents(): Promise<Response> {
  const events = await getCollection<any>(kv_alerts, 'events');
  return jsonResponse(events);
}

async function handleStatusCodes(): Promise<Response> {
  const logs = await getCollection<any>(kv_logs, 'logs');
  const dist: Record<string, number> = {};
  logs.forEach(l => {
    const group = `${Math.floor(l.edge_status_code / 100)}xx`;
    dist[group] = (dist[group] || 0) + 1;
  });
  return jsonResponse(dist);
}

// ── Main Router ──

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Ensure seed data on first request
    await ensureSeedData();

    // ── Metrics ──
    if (url.pathname === '/api/metrics/overview' && request.method === 'GET') {
      return handleOverviewMetrics();
    }
    if (url.pathname === '/api/metrics/timeseries' && request.method === 'GET') {
      return handleTimeSeries(url);
    }
    if (url.pathname === '/api/metrics/top' && request.method === 'GET') {
      return handleTopN(url);
    }
    if (url.pathname === '/api/metrics/status-codes' && request.method === 'GET') {
      return handleStatusCodes();
    }

    // ── Logs ──
    if (url.pathname === '/api/logs/search' && request.method === 'GET') {
      return handleLogSearch(url);
    }
    if (url.pathname.match(/^\/api\/logs\/.+$/) && request.method === 'GET') {
      const id = url.pathname.split('/').pop()!;
      return handleLogDetail(id);
    }

    // ── Analytics ──
    if (url.pathname === '/api/analytics/performance' && request.method === 'GET') {
      return handlePerformanceAnalysis();
    }
    if (url.pathname === '/api/analytics/cache' && request.method === 'GET') {
      return handleCacheAnalysis();
    }
    if (url.pathname === '/api/analytics/origin' && request.method === 'GET') {
      return handleOriginAnalysis();
    }
    if (url.pathname === '/api/analytics/security' && request.method === 'GET') {
      return handleSecurityAnalysis();
    }
    if (url.pathname === '/api/analytics/bots' && request.method === 'GET') {
      return handleBotAnalysis();
    }
    if (url.pathname === '/api/analytics/geo' && request.method === 'GET') {
      return handleGeoData();
    }

    // ── Data Sources ──
    if (url.pathname === '/api/datasources' && request.method === 'GET') {
      return handleDataSources();
    }
    if (url.pathname === '/api/datasources' && request.method === 'POST') {
      return handleCreateDataSource(request);
    }
    if (url.pathname === '/api/datasources/test' && request.method === 'POST') {
      return handleTestDataSource(request);
    }

    // ── Ingestion ──
    if (url.pathname === '/api/ingestion/files' && request.method === 'GET') {
      return handleIngestionFiles();
    }
    if (url.pathname === '/api/ingestion/run' && request.method === 'POST') {
      return handleIngestionRun(request);
    }

    // ── Alerts ──
    if (url.pathname === '/api/alerts/rules' && request.method === 'GET') {
      return handleAlertRules();
    }
    if (url.pathname === '/api/alerts/rules' && request.method === 'POST') {
      return handleCreateAlertRule(request);
    }
    if (url.pathname.match(/^\/api\/alerts\/rules\/.+$/) && request.method === 'PUT') {
      const id = url.pathname.split('/').pop()!;
      return handleToggleAlertRule(id, request);
    }
    if (url.pathname === '/api/alerts/events' && request.method === 'GET') {
      return handleAlertEvents();
    }

    return new Response('Not Found', { status: 404 });
  },
};
