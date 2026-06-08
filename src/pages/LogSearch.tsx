import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel, StatusBadge, Skeleton } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { LogEvent } from '@/lib/types';
import { Search, Filter, X, Copy, ExternalLink, ChevronLeft, ChevronRight, Clock, Globe, Shield, Server, Database } from 'lucide-react';
import { formatDuration } from '@/lib/mock-data';

export default function LogSearchPage() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<LogEvent | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Filter state
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filterParams = new URLSearchParams();
  filterParams.set('page', String(page));
  filterParams.set('page_size', '20');
  Object.entries(filters).forEach(([k, v]) => { if (v) filterParams.set(k, v); });

  const { data: searchResult, isLoading } = useApi<{ logs: LogEvent[]; total: number; query_time_ms: number }>(
    ['logs', 'search', page, ...Object.entries(filters).flat()],
    `/api/logs/search?${filterParams}`
  );

  const logs = searchResult?.logs || [];
  const total = searchResult?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-bold text-foreground">日志检索</h1>
        <div className="flex items-center gap-2">
          {searchResult?.query_time_ms && (
            <span className="text-xs text-muted-foreground">
              查询耗时 {searchResult.query_time_ms}ms · 共 {total} 条
            </span>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 h-7 px-2 rounded-md text-xs bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors"
          >
            <Filter className="w-3 h-3" />
            筛选器
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Panel title="筛选条件" className="animate-slide-in-up">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <FilterInput label="路径" placeholder="/api/..." value={filters.path || ''} onChange={v => updateFilter('path', v)} />
            <FilterInput label="Host" placeholder="example.com" value={filters.host || ''} onChange={v => updateFilter('host', v)} />
            <FilterInput label="客户端 IP" placeholder="1.2.3.4" value={filters.client_ip || ''} onChange={v => updateFilter('client_ip', v)} />
            <FilterInput label="Request ID" placeholder="abc123..." value={filters.request_id || ''} onChange={v => updateFilter('request_id', v)} />
            <FilterSelect label="方法" value={filters.method || ''} onChange={v => updateFilter('method', v)}
              options={['', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']} />
            <FilterSelect label="状态码" value={filters.status_code || ''} onChange={v => updateFilter('status_code', v)}
              options={['', '2xx', '3xx', '4xx', '5xx', '200', '301', '404', '500', '502', '503']} />
            <FilterSelect label="缓存状态" value={filters.cache_status || ''} onChange={v => updateFilter('cache_status', v)}
              options={['', 'HIT', 'MISS', 'BYPASS', 'EXPIRED', 'STALE']} />
            <FilterSelect label="国家" value={filters.country_code || ''} onChange={v => updateFilter('country_code', v)}
              options={['', 'CN', 'US', 'JP', 'DE', 'GB', 'KR', 'SG', 'IN', 'BR', 'RU']} />
            <FilterSelect label="Bot 类型" value={filters.bot_tag || ''} onChange={v => updateFilter('bot_tag', v)}
              options={['', 'normal', 'malicious', 'suspected', 'unrecognized', '-']} />
            <FilterSelect label="安全动作" value={filters.sec_action || ''} onChange={v => updateFilter('sec_action', v)}
              options={['', 'allow', 'deny', 'captcha', 'js_challenge', 'rate_limit', 'log']} />
          </div>
          {Object.values(filters).some(v => v) && (
            <div className="mt-3 flex justify-end">
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3 h-3" />
                清除所有筛选
              </button>
            </div>
          )}
        </Panel>
      )}

      {/* Main Content */}
      <div className={cn('grid gap-4', selectedLog ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1')}>
        {/* Log Table */}
        <div className={cn(selectedLog ? 'lg:col-span-2' : '')}>
          <Panel title="日志列表">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">时间</th>
                        <th className="text-left py-2 px-2 font-medium">方法</th>
                        <th className="text-left py-2 px-2 font-medium">路径</th>
                        <th className="text-left py-2 px-2 font-medium">状态码</th>
                        <th className="text-left py-2 px-2 font-medium">IP</th>
                        <th className="text-left py-2 px-2 font-medium">国家</th>
                        <th className="text-left py-2 px-2 font-medium">缓存</th>
                        <th className="text-left py-2 px-2 font-medium">Bot</th>
                        <th className="text-left py-2 px-2 font-medium">耗时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className={cn(
                            'border-b border-border/50 cursor-pointer transition-colors',
                            selectedLog?.id === log.id ? 'bg-primary/10' : 'hover:bg-secondary/50'
                          )}
                        >
                          <td className="py-1.5 px-2 text-mono text-muted-foreground whitespace-nowrap">
                            {new Date(log.event_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-1.5 px-2">
                            <span className={cn(
                              'font-mono font-medium',
                              log.request_method === 'GET' ? 'text-success' :
                              log.request_method === 'POST' ? 'text-info' :
                              log.request_method === 'DELETE' ? 'text-destructive' : 'text-muted-foreground'
                            )}>
                              {log.request_method}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-mono text-foreground truncate max-w-[180px]" title={log.request_path}>
                            {log.request_path}
                          </td>
                          <td className="py-1.5 px-2">
                            <StatusBadge
                              label={String(log.edge_status_code)}
                              variant={
                                log.edge_status_code < 300 ? 'success' :
                                log.edge_status_code < 400 ? 'info' :
                                log.edge_status_code < 500 ? 'warning' : 'destructive'
                              }
                            />
                          </td>
                          <td className="py-1.5 px-2 text-mono text-muted-foreground">{log.client_ip}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{log.client_country_code}</td>
                          <td className="py-1.5 px-2">
                            <StatusBadge
                              label={log.edge_cache_status}
                              variant={log.edge_cache_status === 'HIT' ? 'success' : log.edge_cache_status === 'MISS' ? 'warning' : 'muted'}
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            {log.bot_tag !== '-' && (
                              <StatusBadge
                                label={log.bot_tag}
                                variant={log.bot_tag === 'malicious' ? 'destructive' : log.bot_tag === 'suspected' ? 'warning' : 'muted'}
                              />
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-mono text-muted-foreground whitespace-nowrap">
                            {log.edge_response_time_ms.toFixed(0)}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      第 {page} 页 / 共 {totalPages} 页
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>

        {/* Detail Drawer */}
        {selectedLog && (
          <div className="lg:col-span-1 animate-slide-in-right">
            <Panel
              title="日志详情"
              actions={
                <button onClick={() => setSelectedLog(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              }
            >
              <div className="space-y-4 text-xs">
                {/* Request ID */}
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <span className="text-mono text-muted-foreground truncate flex-1" title={selectedLog.client_request_id}>
                    {selectedLog.client_request_id}
                  </span>
                  <button onClick={() => copyToClipboard(selectedLog.client_request_id)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                {/* Basic Info */}
                <Section title="基本信息" icon={<Clock className="w-3 h-3" />}>
                  <Field label="时间" value={new Date(selectedLog.event_time).toLocaleString('zh-CN')} />
                  <Field label="站点" value={selectedLog.site_name} />
                  <Field label="Host" value={selectedLog.request_host} />
                  <Field label="方法" value={selectedLog.request_method} />
                  <Field label="路径" value={selectedLog.request_path} />
                  <Field label="协议" value={selectedLog.request_protocol} />
                  <Field label="Scheme" value={selectedLog.request_scheme} />
                  <Field label="User-Agent" value={selectedLog.request_user_agent} copyable />
                  <Field label="Referer" value={selectedLog.request_referer} />
                </Section>

                {/* Client Info */}
                <Section title="客户端信息" icon={<Globe className="w-3 h-3" />}>
                  <Field label="IP" value={selectedLog.client_ip} copyable />
                  <Field label="国家" value={selectedLog.client_country_code} />
                  <Field label="区域" value={selectedLog.client_region_code} />
                  <Field label="ASN" value={selectedLog.client_asn} />
                  <Field label="运营商" value={selectedLog.client_isp} />
                  <Field label="SSL 协议" value={selectedLog.client_ssl_protocol} />
                  <Field label="Bot 标签" value={selectedLog.bot_tag} />
                </Section>

                {/* Edge Info */}
                <Section title="边缘节点" icon={<Database className="w-3 h-3" />}>
                  <Field label="节点 ID" value={selectedLog.edge_server_id} />
                  <Field label="节点 IP" value={selectedLog.edge_server_ip} />
                  <Field label="状态码" value={String(selectedLog.edge_status_code)} />
                  <Field label="缓存状态" value={selectedLog.edge_cache_status} />
                  <Field label="响应大小" value={`${(selectedLog.edge_response_bytes / 1024).toFixed(1)} KB`} />
                  <Field label="Content-Type" value={selectedLog.edge_content_type} />
                  <Field label="响应耗时" value={`${selectedLog.edge_response_time_ms.toFixed(1)}ms`} />
                  <Field label="TTFB" value={`${selectedLog.edge_ttfb_ms.toFixed(1)}ms`} />
                </Section>

                {/* Origin Info */}
                {selectedLog.origin_ip !== '-' && (
                  <Section title="源站信息" icon={<Server className="w-3 h-3" />}>
                    <Field label="源站 IP" value={selectedLog.origin_ip} copyable />
                    <Field label="状态码" value={String(selectedLog.origin_status_code)} />
                    <Field label="DNS 耗时" value={`${selectedLog.origin_dns_ms.toFixed(1)}ms`} />
                    <Field label="TCP 耗时" value={`${selectedLog.origin_tcp_ms.toFixed(1)}ms`} />
                    <Field label="TLS 耗时" value={selectedLog.origin_tls_ms > 0 ? `${selectedLog.origin_tls_ms.toFixed(1)}ms` : '-'} />
                    <Field label="响应耗时" value={`${selectedLog.origin_response_ms.toFixed(1)}ms`} />
                  </Section>
                )}

                {/* Security Info */}
                {(selectedLog.sec_action !== '-' && selectedLog.sec_action !== 'allow') && (
                  <Section title="安全信息" icon={<Shield className="w-3 h-3" />}>
                    <Field label="动作" value={selectedLog.sec_action} />
                    <Field label="规则 ID" value={selectedLog.sec_rule_id} />
                    <Field label="来源" value={selectedLog.sec_source} />
                    <Field label="JA3" value={selectedLog.ja3_hash} copyable />
                    <Field label="JA4" value={selectedLog.ja4_hash} copyable />
                  </Section>
                )}

                {/* Timing Waterfall */}
                <Section title="耗时拆解">
                  <TimingWaterfall log={selectedLog} />
                </Section>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</label>
      <div className="relative mt-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-7 pl-7 pr-2 text-xs bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 mt-1 px-2 text-xs bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt || '全部'}</option>
        ))}
      </select>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-border/50">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center gap-2 group">
      <span className="text-[10px] text-muted-foreground/70 w-20 shrink-0">{label}</span>
      <span className="text-mono text-foreground truncate flex-1" title={value}>{value}</span>
      {copyable && (
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
        >
          <Copy className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function TimingWaterfall({ log }: { log: LogEvent }) {
  const total = log.edge_response_time_ms;
  if (total <= 0) return null;

  const segments = [
    { label: 'Edge TTFB', value: log.edge_ttfb_ms, color: 'bg-primary' },
  ];

  if (log.origin_ip !== '-') {
    segments.push(
      { label: 'DNS', value: Math.max(0, log.origin_dns_ms), color: 'bg-info' },
      { label: 'TCP', value: Math.max(0, log.origin_tcp_ms), color: 'bg-warning' },
    );
    if (log.origin_tls_ms > 0) {
      segments.push({ label: 'TLS', value: log.origin_tls_ms, color: 'bg-chart-5' });
    }
    segments.push({ label: 'Origin', value: Math.max(0, log.origin_response_ms), color: 'bg-destructive' });
  }

  const totalSegments = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="space-y-1.5">
      {segments.map(seg => (
        <div key={seg.label} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-16 shrink-0">{seg.label}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
            <div
              className={cn('h-full rounded-sm', seg.color)}
              style={{ width: `${Math.max(2, (seg.value / Math.max(totalSegments, 1)) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-mono text-muted-foreground w-14 text-right">
            {seg.value.toFixed(1)}ms
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <span className="text-[10px] text-foreground font-medium w-16">总计</span>
        <span className="text-[10px] text-mono text-foreground font-medium">
          {total.toFixed(1)}ms
        </span>
      </div>
    </div>
  );
}
