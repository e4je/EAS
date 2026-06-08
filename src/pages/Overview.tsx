import { useApi } from '@/hooks/useApi';
import { MetricCard, Panel, Skeleton } from '@/components/Dashboard';
import { formatBytes, formatNumber, formatDuration } from '@/lib/mock-data';
import type { OverviewMetrics, TimeSeriesPoint, TopItem } from '@/lib/types';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  ArrowUpRight, ArrowDownRight, Globe, Shield, Zap, Database,
  Server, Activity, TrendingUp, AlertTriangle
} from 'lucide-react';

const CHART_COLORS = [
  'hsl(188 85% 50%)', 'hsl(152 60% 45%)', 'hsl(38 92% 55%)',
  'hsl(0 68% 50%)', 'hsl(280 60% 60%)', 'hsl(200 80% 55%)',
  'hsl(50 90% 55%)', 'hsl(340 70% 55%)',
];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-md p-2 shadow-xl text-xs">
      <p className="text-muted-foreground font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-mono">
          {entry.name}: {typeof entry.value === 'number' && entry.value > 999
            ? formatNumber(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const { data: metrics, isLoading: loadingMetrics } = useApi<OverviewMetrics>(
    ['metrics', 'overview'], '/api/metrics/overview'
  );
  const { data: timeSeries, isLoading: loadingTS } = useApi<TimeSeriesPoint[]>(
    ['timeseries', 'requests'], '/api/metrics/timeseries?metric=requests&hours=24'
  );
  const { data: bandwidthSeries } = useApi<TimeSeriesPoint[]>(
    ['timeseries', 'bandwidth'], '/api/metrics/timeseries?metric=bandwidth&hours=24'
  );
  const { data: statusCodes } = useApi<Record<string, number>>(
    ['status-codes'], '/api/metrics/status-codes'
  );
  const { data: topPaths } = useApi<TopItem[]>(['top', 'paths'], '/api/metrics/top?field=request_path&limit=10');
  const { data: topIPs } = useApi<TopItem[]>(['top', 'ips'], '/api/metrics/top?field=client_ip&limit=10');
  const { data: topHosts } = useApi<TopItem[]>(['top', 'hosts'], '/api/metrics/top?field=request_host&limit=10');
  const { data: topCountries } = useApi<TopItem[]>(['top', 'countries'], '/api/metrics/top?field=client_country_code&limit=10');

  if (loadingMetrics) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const m = metrics || {} as OverviewMetrics;

  const statusPieData = statusCodes
    ? Object.entries(statusCodes).map(([name, value]) => ({ name, value }))
    : [];

  const cacheData = [
    { name: 'HIT', value: m.cache_hit_rate || 0 },
    { name: 'MISS', value: Math.max(0, 100 - (m.cache_hit_rate || 0)) },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-bold text-foreground">总览驾驶舱</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="status-dot bg-success animate-pulse" />
          <span>实时数据</span>
        </div>
      </div>

      {/* Core Metrics Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard
          title="总请求数"
          value={formatNumber(m.total_requests || 0)}
          icon={<Activity className="w-4 h-4 text-primary" />}
          trend={{ value: 12.5, label: '较昨日' }}
        />
        <MetricCard
          title="峰值 QPS"
          value={formatNumber(m.peak_qps || 0)}
          subtitle={`平均 ${formatNumber(m.avg_qps || 0)}`}
          icon={<Zap className="w-4 h-4 text-warning" />}
        />
        <MetricCard
          title="总流量"
          value={formatBytes(m.total_bandwidth_bytes || 0)}
          icon={<Globe className="w-4 h-4 text-info" />}
          trend={{ value: 8.3, label: '较昨日' }}
        />
        <MetricCard
          title="缓存命中率"
          value={`${(m.cache_hit_rate || 0).toFixed(1)}%`}
          icon={<Database className="w-4 h-4 text-success" />}
          color="text-success"
          trend={{ value: 2.1, label: '较昨日' }}
        />
        <MetricCard
          title="回源率"
          value={`${(m.origin_rate || 0).toFixed(1)}%`}
          icon={<Server className="w-4 h-4 text-muted-foreground" />}
        />
        <MetricCard
          title="安全动作"
          value={formatNumber(m.security_actions || 0)}
          icon={<Shield className="w-4 h-4 text-destructive" />}
          color="text-destructive"
        />
      </div>

      {/* Core Metrics Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard
          title="4xx 错误率"
          value={`${(m.error_4xx_rate || 0).toFixed(1)}%`}
          icon={<AlertTriangle className="w-4 h-4 text-warning" />}
          color="text-warning"
        />
        <MetricCard
          title="5xx 错误率"
          value={`${(m.error_5xx_rate || 0).toFixed(1)}%`}
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          color="text-destructive"
          trend={{ value: -0.3, label: '较昨日' }}
        />
        <MetricCard
          title="P50 响应"
          value={formatDuration(m.p50_response_ms || 0)}
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          title="P95 响应"
          value={formatDuration(m.p95_response_ms || 0)}
          icon={<TrendingUp className="w-4 h-4 text-warning" />}
        />
        <MetricCard
          title="P99 响应"
          value={formatDuration(m.p99_response_ms || 0)}
          icon={<TrendingUp className="w-4 h-4 text-destructive" />}
        />
        <MetricCard
          title="恶意 Bot"
          value={`${(m.malicious_bot_rate || 0).toFixed(1)}%`}
          icon={<Shield className="w-4 h-4 text-destructive" />}
          color="text-destructive"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="请求量趋势" subtitle="按小时统计" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={timeSeries || []}>
              <defs>
                <linearGradient id="gradRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(188 85% 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(188 85% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }}
                tickFormatter={(v) => v.split(' ')[1] || v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }}
                tickFormatter={(v) => formatNumber(v)}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(188 85% 50%)"
                fill="url(#gradRequests)"
                strokeWidth={2}
                name="请求数"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="状态码分布" subtitle="按 HTTP 状态码分组">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusPieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {statusPieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                iconSize={8}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="带宽趋势" subtitle="按小时统计">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={bandwidthSeries || timeSeries || []}>
              <defs>
                <linearGradient id="gradBandwidth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(152 60% 45%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(152 60% 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }}
                tickFormatter={(v) => v.split(' ')[1] || v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }}
                tickFormatter={(v) => formatBytes(v)}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="bandwidth"
                stroke="hsl(152 60% 45%)"
                fill="url(#gradBandwidth)"
                strokeWidth={2}
                name="带宽"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="缓存命中率" subtitle="HIT vs MISS">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cacheData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(215 16% 56%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} name="占比">
                <Cell fill="hsl(152 60% 45%)" />
                <Cell fill="hsl(38 92% 55%)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Top N Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <Panel title="Top 路径" subtitle="按请求数排序">
          <TopList data={topPaths || []} />
        </Panel>
        <Panel title="Top IP" subtitle="按请求数排序">
          <TopList data={topIPs || []} />
        </Panel>
        <Panel title="Top Host" subtitle="按请求数排序">
          <TopList data={topHosts || []} />
        </Panel>
        <Panel title="Top 国家/地区" subtitle="按请求数排序">
          <TopList data={topCountries || []} />
        </Panel>
      </div>
    </div>
  );
}

function TopList({ data }: { data: TopItem[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground text-center py-4">暂无数据</p>;

  return (
    <div className="space-y-1.5">
      {data.slice(0, 8).map((item, i) => (
        <div key={item.name} className="flex items-center gap-2 group">
          <span className="text-[10px] text-muted-foreground/50 w-4 text-right font-mono">{i + 1}</span>
          <span className="text-xs text-foreground truncate flex-1 font-mono" title={item.name}>
            {item.name}
          </span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {formatNumber(item.value)}
          </span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 w-10 text-right">
            {item.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
}
