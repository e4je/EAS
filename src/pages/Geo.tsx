import { Panel, Skeleton } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { formatBytes, formatNumber, formatDuration } from '@/lib/mock-data';
import type { GeoPoint } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
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

export default function GeoPage() {
  const { data: geo, isLoading } = useApi<GeoPoint[]>(
    ['analytics', 'geo'], '/api/analytics/geo'
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const points = geo || [];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-lg font-display font-bold text-foreground">地理与网络分析</h1>

      {/* Country Table */}
      <Panel title="国家/地区访问分布" subtitle="按请求数排序">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">#</th>
                <th className="text-left py-2 px-2 font-medium">国家/地区</th>
                <th className="text-left py-2 px-2 font-medium">代码</th>
                <th className="text-right py-2 px-2 font-medium">请求数</th>
                <th className="text-right py-2 px-2 font-medium">流量</th>
                <th className="text-right py-2 px-2 font-medium">错误率</th>
                <th className="text-right py-2 px-2 font-medium">P95 延迟</th>
              </tr>
            </thead>
            <tbody>
              {points.map((g, i) => (
                <tr key={g.country_code} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="py-1.5 px-2 text-mono text-muted-foreground/50">{i + 1}</td>
                  <td className="py-1.5 px-2 text-foreground font-medium">{g.country}</td>
                  <td className="py-1.5 px-2 text-mono text-muted-foreground">{g.country_code}</td>
                  <td className="py-1.5 px-2 text-mono text-right">{formatNumber(g.requests)}</td>
                  <td className="py-1.5 px-2 text-mono text-right">{formatBytes(g.bandwidth_bytes)}</td>
                  <td className="py-1.5 px-2 text-mono text-right">
                    <span className={g.error_rate > 5 ? 'text-destructive' : g.error_rate > 2 ? 'text-warning' : 'text-success'}>
                      {g.error_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-mono text-right">
                    <span className={g.p95_ms > 500 ? 'text-destructive' : g.p95_ms > 200 ? 'text-warning' : 'text-success'}>
                      {formatDuration(g.p95_ms)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="请求数 Top 国家" subtitle="按请求数排序">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={points.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }} tickFormatter={v => formatNumber(v)} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="country" tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }} width={70} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="requests" fill="hsl(188 85% 50%)" radius={[0, 3, 3, 0]} name="请求数" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="P95 延迟 Top 国家" subtitle="延迟最高的国家">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[...points].sort((a, b) => b.p95_ms - a.p95_ms).slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }} tickFormatter={v => `${v}ms`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="country" tick={{ fontSize: 10, fill: 'hsl(215 16% 56%)' }} width={70} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="p95_ms" fill="hsl(38 92% 55%)" radius={[0, 3, 3, 0]} name="P95 延迟" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}
