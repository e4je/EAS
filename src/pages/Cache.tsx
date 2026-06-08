import { Panel, Skeleton } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { formatBytes, formatNumber } from '@/lib/mock-data';
import type { CacheAnalysis, TopItem } from '@/lib/types';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CHART_COLORS = [
  'hsl(152 60% 45%)', 'hsl(38 92% 55%)', 'hsl(200 80% 55%)',
  'hsl(0 68% 50%)', 'hsl(280 60% 60%)', 'hsl(50 90% 55%)',
  'hsl(340 70% 55%)', 'hsl(188 85% 50%)',
];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-md p-2 shadow-xl text-xs">
      <p className="text-muted-foreground font-medium mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p style={{ color: entry.color }} className="font-mono">
          {entry.name}: {typeof entry.value === 'number' && entry.value > 999
            ? formatNumber(entry.value)
            : `${entry.value}%`}
        </p>
      ))}
    </div>
  );
}

export default function CachePage() {
  const { data: cache, isLoading } = useApi<CacheAnalysis>(
    ['analytics', 'cache'], '/api/analytics/cache'
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const c = cache || {} as CacheAnalysis;

  const statusPieData = c.status_distribution
    ? Object.entries(c.status_distribution).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-lg font-display font-bold text-foreground">缓存分析</h1>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">缓存命中率</p>
          <p className="text-2xl font-display font-bold text-success mt-1">{(c.hit_rate || 0).toFixed(1)}%</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">MISS 率</p>
          <p className="text-2xl font-display font-bold text-warning mt-1">{(c.miss_rate || 0).toFixed(1)}%</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">BYPASS 率</p>
          <p className="text-2xl font-display font-bold text-info mt-1">{(c.bypass_rate || 0).toFixed(1)}%</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">节省流量</p>
          <p className="text-2xl font-display font-bold text-primary mt-1">{formatBytes(c.bandwidth_saved_bytes || 0)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="缓存状态分布" subtitle="按 EdgeCacheStatus 分组">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusPieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
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

        <Panel title="Top MISS/BYPASS 路径" subtitle="缓存未命中最多的路径">
          <TopTable data={c.top_miss_paths || []} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="缓存优化建议" subtitle="基于当前数据分析">
          <div className="space-y-3 text-xs">
            {(c.top_miss_paths || []).slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md border border-warning/20 bg-warning/5">
                <span className="status-dot mt-1 bg-warning" />
                <div>
                  <p className="text-xs font-medium text-foreground font-mono">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    MISS 次数 {formatNumber(item.value)}，占比 {item.percentage}%，建议检查缓存规则
                  </p>
                </div>
              </div>
            ))}
            {!(c.top_miss_paths || []).length && (
              <p className="text-muted-foreground text-center py-4">暂无优化建议</p>
            )}
          </div>
        </Panel>

        <Panel title="Top BYPASS 路径" subtitle="绕过缓存的请求">
          <TopTable data={c.top_bypass_paths || []} />
        </Panel>
      </div>
    </div>
  );
}

function TopTable({ data }: { data: TopItem[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground text-center py-8">暂无数据</p>;
  return (
    <div className="space-y-1">
      {data.slice(0, 12).map((item, i) => (
        <div key={item.name} className="flex items-center gap-2 py-1">
          <span className="text-[10px] text-muted-foreground/50 w-4 text-right font-mono">{i + 1}</span>
          <span className="text-xs text-foreground truncate flex-1 font-mono" title={item.name}>{item.name}</span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">{formatNumber(item.value)}</span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 w-10 text-right">{item.percentage}%</span>
        </div>
      ))}
    </div>
  );
}
