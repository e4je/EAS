import { useState } from 'react';
import { Panel, Skeleton, StatusBadge } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { AlertRule, AlertEvent } from '@/lib/types';
import { Bell, Plus, AlertTriangle, Info, Shield } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const initialRuleForm = {
  name: '',
  metric: 'error_5xx_rate',
  operator: 'gt',
  threshold: '5',
  duration_minutes: '5',
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'rules' | 'events'>('rules');
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState(initialRuleForm);
  const [savingRule, setSavingRule] = useState(false);

  const { data: rules, isLoading: loadingRules } = useApi<AlertRule[]>(
    ['alerts', 'rules'], '/api/alerts/rules'
  );
  const { data: events, isLoading: loadingEvents } = useApi<AlertEvent[]>(
    ['alerts', 'events'], '/api/alerts/events'
  );

  const toggleRule = async (rule: AlertRule) => {
    const res = await fetch(`/api/alerts/rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (!res.ok) {
      toast.error('规则状态更新失败');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
  };

  const updateRuleForm = (field: keyof typeof initialRuleForm, value: string) => {
    setRuleForm(prev => ({ ...prev, [field]: value }));
  };

  const createRule = async () => {
    if (!ruleForm.name.trim()) {
      toast.error('请填写规则名称');
      return;
    }

    const threshold = Number(ruleForm.threshold);
    const duration = Number(ruleForm.duration_minutes);
    if (!Number.isFinite(threshold) || !Number.isFinite(duration)) {
      toast.error('阈值和持续时间必须是数字');
      return;
    }

    setSavingRule(true);
    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: ruleForm.name.trim(),
          type: 'threshold',
          enabled: true,
          condition: {
            metric: ruleForm.metric,
            operator: ruleForm.operator,
            threshold,
            duration_minutes: duration,
          },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('告警规则已创建');
      setRuleForm(initialRuleForm);
      setShowRuleForm(false);
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
    } catch (e: any) {
      toast.error('创建规则失败', { description: e.message });
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-bold text-foreground">告警中心</h1>
        <button
          onClick={() => {
            setActiveTab('rules');
            setShowRuleForm(prev => !prev);
          }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          新建规则
        </button>
      </div>

      {/* Active Alerts Banner */}
      {events?.filter(e => e.status === 'active').length && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              {events.filter(e => e.status === 'active').length} 个活跃告警
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {events.filter(e => e.status === 'active').map(e => e.rule_name).join('、')}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('rules')}
          className={cn(
            'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'rules'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          告警规则
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={cn(
            'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'events'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          告警历史
          {events?.filter(e => e.status === 'active').length && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold">
              {events.filter(e => e.status === 'active').length}
            </span>
          )}
        </button>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          {showRuleForm && (
            <Panel title="新建告警规则">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                <RuleField label="名称" value={ruleForm.name} onChange={v => updateRuleForm('name', v)} placeholder="源站 5xx 异常" />
                <RuleSelect label="指标" value={ruleForm.metric} onChange={v => updateRuleForm('metric', v)} options={['error_5xx_rate', 'error_4xx_rate', 'origin_rate', 'cache_hit_rate', 'p95_response_ms']} />
                <RuleSelect label="条件" value={ruleForm.operator} onChange={v => updateRuleForm('operator', v)} options={['gt', 'gte', 'lt', 'lte', 'eq']} />
                <RuleField label="阈值" value={ruleForm.threshold} onChange={v => updateRuleForm('threshold', v)} placeholder="5" />
                <RuleField label="持续分钟" value={ruleForm.duration_minutes} onChange={v => updateRuleForm('duration_minutes', v)} placeholder="5" />
              </div>
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
                <button
                  onClick={() => { setShowRuleForm(false); setRuleForm(initialRuleForm); }}
                  className="h-8 px-3 rounded-md text-xs bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={createRule}
                  disabled={savingRule}
                  className="h-8 px-3 rounded-md text-xs bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingRule ? '保存中...' : '保存'}
                </button>
              </div>
            </Panel>
          )}
          {loadingRules ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            (rules || []).map(rule => (
              <div
                key={rule.id}
                className={cn(
                  'rounded-md border p-4 flex items-center gap-4 transition-colors',
                  rule.enabled ? 'bg-card border-border panel-glow' : 'bg-card/50 border-border/50 opacity-60'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
                  rule.enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{rule.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    指标: {rule.condition.metric} · 条件: {rule.condition.operator} {rule.condition.threshold} · 持续 {rule.condition.duration_minutes} 分钟
                  </p>
                </div>
                <StatusBadge
                  label={rule.enabled ? '已启用' : '已禁用'}
                  variant={rule.enabled ? 'success' : 'muted'}
                />
                <button
                  onClick={() => toggleRule(rule)}
                  className={cn(
                    'h-7 px-3 rounded-md text-xs font-medium transition-colors',
                    rule.enabled
                      ? 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
                      : 'bg-primary/15 text-primary border border-primary/20 hover:bg-primary/20'
                  )}
                >
                  {rule.enabled ? '禁用' : '启用'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-3">
          {loadingEvents ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            (events || []).map(event => (
              <div
                key={event.id}
                className={cn(
                  'rounded-md border p-4 flex items-center gap-4',
                  event.status === 'active' ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
                  event.severity === 'critical' ? 'bg-destructive/15 text-destructive' :
                  event.severity === 'warning' ? 'bg-warning/15 text-warning' : 'bg-info/15 text-info'
                )}>
                  {event.severity === 'critical' ? <AlertTriangle className="w-4 h-4" /> :
                   event.severity === 'warning' ? <Shield className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{event.rule_name}</p>
                    <StatusBadge
                      label={event.status === 'active' ? '活跃' : event.status === 'resolved' ? '已恢复' : '已静默'}
                      variant={event.status === 'active' ? 'destructive' : event.status === 'resolved' ? 'success' : 'muted'}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    触发: {new Date(event.triggered_at).toLocaleString('zh-CN')}
                    {event.resolved_at && ` · 恢复: ${new Date(event.resolved_at).toLocaleString('zh-CN')}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-foreground">
                    {event.value} / {event.threshold}
                  </p>
                  <p className="text-[10px] text-muted-foreground">当前值 / 阈值</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function RuleField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 mt-1 px-3 text-xs bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function RuleSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-8 mt-1 px-2 text-xs bg-secondary border border-border rounded-md text-foreground"
      >
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
