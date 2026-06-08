import { Panel, Skeleton } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { formatDuration, formatNumber } from '@/lib/mock-data';
import type { PerformanceBreakdown, TopItem } from '@/lib/types';
import {
  BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-md p-2 shadow-xl text-xs">
      <p className="text-muted-foreground font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-mono">
          {entry.name}: {formatDuration(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const { data: perf, isLoading } = useApi<PerformanceBreakdown>(
    ['analytics', 'performance'], '/api/analytics/performance'
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const p = perf || {} as PerformanceBreakdown;

  const breakdownData = [
    { name: 'Edge 平均', value: p.edge_avg_ms || 0 },
    { name: 'Edge P95', value: p.edge_p95_ms || 0 },
    { name: 'DNS 平均', value: p.origin_dns_avg_ms || 0 },
    { name: 'TCP 平均', value: p.origin_tcp_avg_ms || 0 },
    { name: 'TLS 平均', value: p.origin_tls_avg_ms || 0 },
    { name: '源站平均', value: p.origin_response_avg_ms || 0 },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-lg font-display font-bold text-foreground">性能分析</h1>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricItem label="Edge 平均" value={formatDuration(p.edge_avg_ms || 0)} color="text-primary" />
        <MetricItem label="Edge P95" value={formatDuration(p.edge_p95_ms || 0)} color="text-warning" />
        <MetricItem label="DNS 平均" value={formatDuration(p.origin_dns_avg_ms || 0)} color="text-info" />
        <MetricItem label="TCP 平均" value={formatDuration(p.origin_tcp_avg_ms || 0)} color="text-chart-7" />
        <MetricItem label="TLS 平均" value={formatDuration(p.origin_tls_avg_ms || 0)} color="text-chart-5" />
        <MetricItem label="源站平均" value={formatDuration(p.origin_response_avg_ms || 0)} color="text-destructive" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="耗时分布" subtitle="各阶段平均耗时对比">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={breakdownData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }} tickFormatter={v => `${v}ms`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }} width={80} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} name="耗时">
                {breakdownData.map((_, i) => (
                  <Cell key={i} fill={[
                    'hsl(188 85% 50%)', 'hsl(38 92% 55%)', 'hsl(200 80% 55%)',
                    'hsl(50 90% 55%)', 'hsl(280 60% 60%)', 'hsl(0 68% 50%)'
                  ][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="慢请求 Top 路径" subtitle="按平均响应时间排序">
          <TopTable data={p.slow_paths || []} valueFormatter={v => formatDuration(v)} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="慢源站 IP" subtitle="按平均响应时间排序">
          <TopTable data={p.slow_origins || []} valueFormatter={v => formatDuration(v)} />
        </Panel>

        <Panel title="性能洞察" subtitle="自动分析">
          <div className="space-y-3 text-xs">
            <InsightItem
              title="边缘节点性能"
              description={`Edge P95 响应时间为 ${formatDuration(p.edge_p95_ms || 0)}，${(p.edge_p95_ms || 0) > 500 ? '建议检查缓存策略和边缘配置' : '处于正常范围'}`}
              severity={(p.edge_p95_ms || 0) > 500 ? 'warning' : 'success'}
            />
            <InsightItem
              title="源站响应"
              description={`源站平均响应时间 ${formatDuration(p.origin_response_avg_ms || 0)}，${(p.origin_response_avg_ms || 0) > 1000 ? '存在明显慢请求' : '处于正常范围'}`}
              severity={(p.origin_response_avg_ms || 0) > 1000 ? 'warning' : 'success'}
            />
            <InsightItem
              title="DNS 解析"
              description={`平均 DNS 解析耗时 ${formatDuration(p.origin_dns_avg_ms || 0)}，${(p.origin_dns_avg_ms || 0) > 50 ? '建议优化 DNS 配置' : '表现良好'}`}
              severity={(p.origin_dns_avg_ms || 0) > 50 ? 'warning' : 'success'}
            />
            <InsightItem
              title="TLS 握手"
              description={`平均 TLS 握手耗时 ${formatDuration(p.origin_tls_avg_ms || 0)}，${(p.origin_tls_avg_ms || 0) > 200 ? '建议启用 TLS 1.3 和会话复用' : '表现良好'}`}
              severity={(p.origin_tls_avg_ms || 0) > 200 ? 'warning' : 'success'}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MetricItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md bg-card border border-border p-3 panel-glow">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-display font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function TopTable({ data, valueFormatter }: { data: TopItem[]; valueFormatter: (v: number) => string }) {
  if (!data.length) return <p className="text-xs text-muted-foreground text-center py-8">暂无数据</p>;
  return (
    <div className="space-y-1">
      {data.slice(0, 10).map((item, i) => (
        <div key={item.name} className="flex items-center gap-2 py-1">
          <span className="text-[10px] text-muted-foreground/50 w-4 text-right font-mono">{i + 1}</span>
          <span className="text-xs text-foreground truncate flex-1 font-mono" title={item.name}>{item.name}</span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">{valueFormatter(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function InsightItem({ title, description, severity }: { title: string; description: string; severity: 'success' | 'warning' | 'destructive' }) {
  const colors = {
    success: 'border-success/20 bg-success/5',
    warning: 'border-warning/20 bg-warning/5',
    destructive: 'border-destructive/20 bg-destructive/5',
  };
  const dotColors = {
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
  };

  return (
    <div className={`flex items-start gap-2 p-2 rounded-md border ${colors[severity]}`}>
      <span className={`status-dot mt-1 ${dotColors[severity]}`} />
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
