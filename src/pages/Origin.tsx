import { Panel, Skeleton } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { formatDuration, formatNumber } from '@/lib/mock-data';
import type { OriginAnalysis, TopItem } from '@/lib/types';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-md p-2 shadow-xl text-xs">
      <p className="text-muted-foreground font-medium mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p style={{ color: entry.color }} className="font-mono">
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function OriginPage() {
  const { data: origin, isLoading } = useApi<OriginAnalysis>(
    ['analytics', 'origin'], '/api/analytics/origin'
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  const o = origin || {} as OriginAnalysis;

  const timingData = [
    { name: 'DNS', value: o.avg_dns_ms || 0 },
    { name: 'TCP', value: o.avg_tcp_ms || 0 },
    { name: 'TLS', value: o.avg_tls_ms || 0 },
    { name: '响应', value: o.avg_response_ms || 0 },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-lg font-display font-bold text-foreground">回源分析</h1>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">回源请求数</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{formatNumber(o.total_origin_requests || 0)}</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">回源率</p>
          <p className="text-2xl font-display font-bold text-info mt-1">{(o.origin_rate || 0).toFixed(1)}%</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">源站 5xx</p>
          <p className="text-2xl font-display font-bold text-destructive mt-1">{formatNumber(o.origin_5xx_count || 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">占比 {(o.origin_5xx_rate || 0).toFixed(1)}%</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">平均响应</p>
          <p className="text-2xl font-display font-bold text-warning mt-1">{formatDuration(o.avg_response_ms || 0)}</p>
        </div>
      </div>

      {/* Timing Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetricItem label="DNS 平均" value={formatDuration(o.avg_dns_ms || 0)} color={((o.avg_dns_ms || 0) > 50) ? 'text-warning' : 'text-success'} />
        <MetricItem label="TCP 平均" value={formatDuration(o.avg_tcp_ms || 0)} color={((o.avg_tcp_ms || 0) > 100) ? 'text-warning' : 'text-success'} />
        <MetricItem label="TLS 平均" value={formatDuration(o.avg_tls_ms || 0)} color={((o.avg_tls_ms || 0) > 200) ? 'text-warning' : 'text-success'} />
        <MetricItem label="响应平均" value={formatDuration(o.avg_response_ms || 0)} color={((o.avg_response_ms || 0) > 1000) ? 'text-destructive' : 'text-foreground'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="回源耗时分布" subtitle="DNS / TCP / TLS / 响应">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={timingData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }} tickFormatter={v => `${v}ms`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215 16% 56%)' }} width={40} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} name="耗时">
                <Cell fill="hsl(200 80% 55%)" />
                <Cell fill="hsl(50 90% 55%)" />
                <Cell fill="hsl(280 60% 60%)" />
                <Cell fill="hsl(0 68% 50%)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top 源站 IP" subtitle="按请求数排序">
          <TopTable data={o.top_origin_ips || []} />
        </Panel>
      </div>

      <Panel title="源站慢请求 Top" subtitle="按源站响应时间排序">
        <TopTable data={o.slow_requests || []} valueFormatter={v => formatDuration(v)} />
      </Panel>
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

function TopTable({ data, valueFormatter }: { data: TopItem[]; valueFormatter?: (v: number) => string }) {
  if (!data.length) return <p className="text-xs text-muted-foreground text-center py-8">暂无数据</p>;
  return (
    <div className="space-y-1">
      {data.slice(0, 12).map((item, i) => (
        <div key={item.name} className="flex items-center gap-2 py-1">
          <span className="text-[10px] text-muted-foreground/50 w-4 text-right font-mono">{i + 1}</span>
          <span className="text-xs text-foreground truncate flex-1 font-mono" title={item.name}>{item.name}</span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {valueFormatter ? valueFormatter(item.value) : formatNumber(item.value)}
          </span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 w-10 text-right">{item.percentage}%</span>
        </div>
      ))}
    </div>
  );
}
