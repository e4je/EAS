import { useState, useEffect, useCallback } from 'react';
import { Panel, StatusBadge } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { formatNumber } from '@/lib/mock-data';
import type { LogEvent } from '@/lib/types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { Play, Pause, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-md p-2 shadow-xl text-xs">
      <p className="text-muted-foreground font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-mono">
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function RealtimePage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [liveLogs, setLiveLogs] = useState<LogEvent[]>([]);
  const [qpsHistory, setQpsHistory] = useState<{ time: string; qps: number; errors: number }[]>([]);

  const { data: searchResult, refetch } = useApi<{ logs: LogEvent[]; total: number }>(
    ['logs', 'realtime'], '/api/logs/search?page=1&page_size=50'
  );

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(refresh, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, refresh]);

  useEffect(() => {
    if (searchResult?.logs) {
      setLiveLogs(searchResult.logs.slice(0, 30));
      const now = new Date();
      setQpsHistory(prev => {
        const newEntry = {
          time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          qps: Math.floor(Math.random() * 200) + 500,
          errors: Math.floor(Math.random() * 30),
        };
        return [...prev.slice(-59), newEntry];
      });
    }
  }, [searchResult]);

  const errorRate = liveLogs.filter(l => l.edge_status_code >= 500).length / (liveLogs.length || 1) * 100;
  const originRate = liveLogs.filter(l => l.origin_ip !== '-').length / (liveLogs.length || 1) * 100;
  const cacheHitRate = liveLogs.filter(l => l.edge_cache_status === 'HIT').length / (liveLogs.length || 1) * 100;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-bold text-foreground">实时监控</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">刷新间隔</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="h-7 px-2 text-xs bg-secondary border border-border rounded-md text-foreground"
            >
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
            </select>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors',
              autoRefresh
                ? 'bg-success/15 text-success border border-success/20'
                : 'bg-secondary text-muted-foreground border border-border'
            )}
          >
            {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {autoRefresh ? '运行中' : '已暂停'}
          </button>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-xs text-muted-foreground">实时 QPS</p>
          <p className="text-xl font-display font-bold text-primary mt-1">
            {qpsHistory.length > 0 ? formatNumber(qpsHistory[qpsHistory.length - 1].qps) : '---'}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Zap className="w-3 h-3 text-success" />
            <span className="text-[10px] text-success">正常</span>
          </div>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-xs text-muted-foreground">错误率 (5xx)</p>
          <p className={cn('text-xl font-display font-bold mt-1', errorRate > 5 ? 'text-destructive' : 'text-foreground')}>
            {errorRate.toFixed(1)}%
          </p>
          {errorRate > 5 && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3 text-destructive" />
              <span className="text-[10px] text-destructive">异常</span>
            </div>
          )}
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-xs text-muted-foreground">缓存命中率</p>
          <p className="text-xl font-display font-bold text-success mt-1">
            {cacheHitRate.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-md bg-card border border-border p-3 panel-glow">
          <p className="text-xs text-muted-foreground">回源率</p>
          <p className="text-xl font-display font-bold mt-1">
            {originRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="QPS 趋势" subtitle="实时">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={qpsHistory}>
              <defs>
                <linearGradient id="gradQPS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(188 85% 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(188 85% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(215 16% 56%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(215 16% 56%)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="qps" stroke="hsl(188 85% 50%)" fill="url(#gradQPS)" strokeWidth={2} name="QPS" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="错误数趋势" subtitle="实时">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={qpsHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(215 16% 56%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(215 16% 56%)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="errors" fill="hsl(0 68% 50%)" radius={[2, 2, 0, 0]} name="错误数" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Live Request Stream */}
      <Panel title="最新请求流" subtitle="最近 30 条请求">
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
                <th className="text-left py-2 px-2 font-medium">耗时</th>
              </tr>
            </thead>
            <tbody>
              {liveLogs.map((log, i) => (
                <tr
                  key={log.id}
                  className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td className="py-1.5 px-2 text-mono text-muted-foreground">
                    {new Date(log.event_time).toLocaleTimeString('zh-CN')}
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
                  <td className="py-1.5 px-2 text-mono text-foreground truncate max-w-[200px]" title={log.request_path}>
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
                  <td className="py-1.5 px-2 text-mono text-muted-foreground">
                    {log.edge_response_time_ms.toFixed(0)}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
