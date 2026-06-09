import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { ThemeProvider, useTheme } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import {
  LayoutDashboard, Activity, Search, Gauge, Database, Server,
  Shield, Bot, Globe, Bell, Settings, ChevronLeft, ChevronRight,
  Moon, Sun, Clock, RefreshCw, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import OverviewPage from '@/pages/Overview';
import RealtimePage from '@/pages/Realtime';
import LogSearchPage from '@/pages/LogSearch';
import PerformancePage from '@/pages/Performance';
import CachePage from '@/pages/Cache';
import OriginPage from '@/pages/Origin';
import SecurityPage from '@/pages/Security';
import BotPage from '@/pages/Bot';
import GeoPage from '@/pages/Geo';
import AlertsPage from '@/pages/Alerts';
import SettingsPage from '@/pages/Settings';
import { useApi } from '@/hooks/useApi';
import type { AlertEvent } from '@/lib/types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, refetchOnWindowFocus: false },
  },
});

const NAV_ITEMS = [
  { label: '总览', icon: LayoutDashboard, path: '/' },
  { label: '实时监控', icon: Activity, path: '/realtime' },
  { label: '日志检索', icon: Search, path: '/logs' },
  { label: '性能分析', icon: Gauge, path: '/performance' },
  { label: '缓存分析', icon: Database, path: '/cache' },
  { label: '回源分析', icon: Server, path: '/origin' },
  { label: '安全分析', icon: Shield, path: '/security' },
  { label: 'Bot 分析', icon: Bot, path: '/bots' },
  { label: '地理分析', icon: Globe, path: '/geo' },
  { label: '告警中心', icon: Bell, path: '/alerts' },
  { label: '数据源设置', icon: Settings, path: '/settings' },
];

function Sidebar({ collapsed, activeAlerts, onToggle }: { collapsed: boolean; activeAlerts: number; onToggle: () => void }) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-sm text-sidebar-foreground tracking-tight">
              ESA Analytics
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center mx-auto">
            <Activity className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-2 px-1.5 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 rounded-md text-sm transition-all duration-150',
                collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn('w-4 h-4 shrink-0', isActive && 'text-primary')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {item.label === '告警中心' && activeAlerts > 0 && !collapsed && (
                <span className="ml-auto w-5 h-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold flex items-center justify-center">
                  {activeAlerts}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Button */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full h-8 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}

function HeaderBar({ collapsed, activeAlerts }: { collapsed: boolean; activeAlerts: number }) {
  const { theme, setTheme } = useTheme();
  const [timeRange, setTimeRange] = useState('24h');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setLastRefresh(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center px-4 gap-3 transition-all duration-300',
        collapsed ? 'left-14' : 'left-56'
      )}
    >
      {/* Time Range Selector */}
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="h-7 px-2 text-xs bg-secondary text-secondary-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        >
          <option value="5m">最近 5 分钟</option>
          <option value="15m">最近 15 分钟</option>
          <option value="1h">最近 1 小时</option>
          <option value="6h">最近 6 小时</option>
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
        </select>
      </div>

      <div className="flex-1" />

      {/* Status */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="status-dot bg-success animate-pulse" />
        <span>数据同步中</span>
      </div>

      {/* Last Refresh */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <RefreshCw className="w-3 h-3" />
        <span>{lastRefresh.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {activeAlerts > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          <span>{activeAlerts} 活跃告警</span>
        </div>
      )}

      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>
    </header>
  );
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { data: alertEvents } = useApi<AlertEvent[]>(['alerts', 'events'], '/api/alerts/events');
  const activeAlerts = (alertEvents || []).filter(event => event.status === 'active').length;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} activeAlerts={activeAlerts} onToggle={() => setCollapsed(!collapsed)} />
      <HeaderBar collapsed={collapsed} activeAlerts={activeAlerts} />
      <main
        className={cn(
          'pt-14 transition-all duration-300',
          collapsed ? 'pl-14' : 'pl-56'
        )}
      >
        <div className="p-4">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/realtime" element={<RealtimePage />} />
            <Route path="/logs" element={<LogSearchPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/cache" element={<CachePage />} />
            <Route path="/origin" element={<OriginPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/bots" element={<BotPage />} />
            <Route path="/geo" element={<GeoPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AppLayout />
        </HashRouter>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            className: 'bg-card border-border text-foreground',
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
