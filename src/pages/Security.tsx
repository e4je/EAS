import { Panel, Skeleton, StatusBadge } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { formatNumber } from '@/lib/mock-data';
import type { SecurityAnalysis, TopItem } from '@/lib/types';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CHART_COLORS = [
  'hsl(0 68% 50%)', 'hsl(38 92% 55%)', 'hsl(188 85% 50%)',
  'hsl(200 80% 55%)', 'hsl(280 60% 60%)', 'hsl(340 70% 55%)',
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

export default function SecurityPage() {
  const { data: sec, isLoading } = useApi<SecurityAnalysis>(
    ['analytics', 'security'], '/api/analytics/security'
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

  const s = sec || {} as SecurityAnalysis;

  const actionPieData = s.sec_action_distribution
    ? Object.entries(s.sec_action_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const sourcePieData = s.sec_source_distribution
    ? Object.entries(s.sec_source_distribution).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-lg font-display font-bold text-foreground">安全分析</h1>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">安全动作总数</p>
          <p className="text-2xl font-display font-bold text-destructive mt-1">{formatNumber(s.total_security_actions || 0)}</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">恶意 Bot</p>
          <p className="text-2xl font-display font-bold text-destructive mt-1">{formatNumber(s.malicious_bot_count || 0)}</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">可疑 Bot</p>
          <p className="text-2xl font-display font-bold text-warning mt-1">{formatNumber(s.suspected_bot_count || 0)}</p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">高频 IP</p>
          <p className="text-2xl font-display font-bold text-info mt-1">{(s.high_frequency_ips || []).length}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="安全动作分布" subtitle="按 SecAction 分组">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={actionPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                {actionPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="规则来源分布" subtitle="按 SecSource 分组">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sourcePieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                {sourcePieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top 规则 ID" subtitle="按触发次数排序">
          <TopTable data={s.top_rule_ids || []} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="高频攻击 IP" subtitle="触发安全动作最多的 IP">
          <TopTable data={s.high_frequency_ips || []} />
        </Panel>

        <Panel title="可疑 User-Agent" subtitle="扫描器 / 自动化工具">
          <TopTable data={s.suspicious_uas || []} />
        </Panel>
      </div>

      {/* Risk Insights */}
      <Panel title="风险洞察" subtitle="自动安全分析">
        <div className="space-y-3 text-xs">
          {(s.malicious_bot_count || 0) > 0 && (
            <RiskItem
              severity="critical"
              title="恶意 Bot 活动"
              description={`检测到 ${formatNumber(s.malicious_bot_count || 0)} 次恶意 Bot 请求，建议加强 Bot 管理规则`}
            />
          )}
          {(s.high_frequency_ips || []).length > 0 && (
            <RiskItem
              severity="warning"
              title="高频 IP 异常"
              description={`发现 ${(s.high_frequency_ips || []).length} 个高频 IP，建议检查是否存在扫描行为`}
            />
          )}
          {(s.suspicious_uas || []).length > 0 && (
            <RiskItem
              severity="warning"
              title="可疑 User-Agent"
              description={`检测到 ${(s.suspicious_uas || []).length} 种可疑 UA，包括扫描器和自动化工具`}
            />
          )}
          <RiskItem
            severity="info"
            title="TLS 指纹分析"
            description="建议定期审查 JA3/JA4 指纹分布，识别异常客户端"
          />
        </div>
      </Panel>
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
        </div>
      ))}
    </div>
  );
}

function RiskItem({ severity, title, description }: { severity: 'critical' | 'warning' | 'info'; title: string; description: string }) {
  const colors = {
    critical: 'border-destructive/20 bg-destructive/5',
    warning: 'border-warning/20 bg-warning/5',
    info: 'border-info/20 bg-info/5',
  };
  const dotColors = {
    critical: 'bg-destructive',
    warning: 'bg-warning',
    info: 'bg-info',
  };

  return (
    <div className={`flex items-start gap-2 p-2 rounded-md border ${colors[severity]}`}>
      <span className={`status-dot mt-1 ${dotColors[severity]}`} />
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-foreground">{title}</p>
          <StatusBadge
            label={severity === 'critical' ? '严重' : severity === 'warning' ? '警告' : '提示'}
            variant={severity === 'critical' ? 'destructive' : severity === 'warning' ? 'warning' : 'info'}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
