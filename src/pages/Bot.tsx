import { Panel, Skeleton, StatusBadge } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { formatNumber } from '@/lib/mock-data';
import type { BotAnalysis, TopItem } from '@/lib/types';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CHART_COLORS = [
  'hsl(152 60% 45%)', 'hsl(0 68% 50%)', 'hsl(38 92% 55%)',
  'hsl(200 80% 55%)', 'hsl(280 60% 60%)',
];

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

export default function BotPage() {
  const { data: bot, isLoading } = useApi<BotAnalysis>(
    ['analytics', 'bots'], '/api/analytics/bots'
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  const b = bot || {} as BotAnalysis;

  const distPieData = b.distribution
    ? Object.entries(b.distribution).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-lg font-display font-bold text-foreground">Bot 与爬虫分析</h1>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Bot 总数</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{formatNumber(b.total_bots || 0)}</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Bot 占比</p>
          <p className="text-2xl font-display font-bold text-info mt-1">{(b.bot_rate || 0).toFixed(1)}%</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">恶意 Bot</p>
          <p className="text-2xl font-display font-bold text-destructive mt-1">
            {formatNumber(b.distribution?.malicious || 0)}
          </p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">可疑 Bot</p>
          <p className="text-2xl font-display font-bold text-warning mt-1">
            {formatNumber(b.distribution?.suspected || 0)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Bot 类型分布" subtitle="按 BotTag 分组">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={distPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                {distPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top Bot IP" subtitle="按 Bot 请求数排序">
          <TopTable data={b.top_bot_ips || []} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top Bot User-Agent" subtitle="Bot 使用的 UA">
          <TopTable data={b.top_bot_uas || []} />
        </Panel>

        <Panel title="Top Bot 访问路径" subtitle="Bot 最常访问的路径">
          <TopTable data={b.top_bot_paths || []} />
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
