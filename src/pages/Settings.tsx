import { useState } from 'react';
import { Panel, StatusBadge } from '@/components/Dashboard';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import { apiFetch, parseApiResponse } from '@/lib/api';
import type { DataSourceConfig, IngestionFile } from '@/lib/types';
import { Database, Plus, CheckCircle, XCircle, Loader2, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface FormData {
  name: string;
  endpoint: string;
  bucket: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  prefix: string;
  format: string;
  timezone: string;
}

const initialFormData: FormData = {
  name: '',
  endpoint: '',
  bucket: '',
  region: '',
  access_key_id: '',
  secret_access_key: '',
  prefix: '',
  format: 'jsonl',
  timezone: 'Asia/Shanghai',
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'datasources' | 'ingestion'>('datasources');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null); // datasource_id being synced
  const [syncProgress, setSyncProgress] = useState<{ batches: number; files: number; records: number } | null>(null);

  const { data: datasources, isLoading: loadingDS } = useApi<DataSourceConfig[]>(
    ['datasources'], '/api/datasources'
  );
  const { data: ingestionFiles, isLoading: loadingIngestion } = useApi<IngestionFile[]>(
    ['ingestion', 'files'], '/api/ingestion/files'
  );

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validate
    if (!formData.name.trim()) {
      toast.error('请填写数据源名称');
      return;
    }
    if (!formData.endpoint.trim()) {
      toast.error('请填写 Endpoint');
      return;
    }
    if (!formData.bucket.trim()) {
      toast.error('请填写 Bucket');
      return;
    }
    if (!formData.access_key_id.trim()) {
      toast.error('请填写 Access Key ID');
      return;
    }
    if (!formData.secret_access_key.trim()) {
      toast.error('请填写 Secret Access Key');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/datasources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(formData),
      });
      await parseApiResponse(res);
      if (res.ok) {
        toast.success('数据源已保存');
        setFormData(initialFormData);
        setShowAddForm(false);
        queryClient.invalidateQueries({ queryKey: ['datasources'] });
      } else {
        toast.error('保存失败');
      }
    } catch {
      toast.error('保存失败，请检查网络连接');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.endpoint || !formData.bucket || !formData.access_key_id || !formData.secret_access_key) {
      toast.error('请先填写 Endpoint、Bucket、Access Key 和 Secret Key');
      return;
    }
    try {
      const res = await apiFetch('/api/datasources/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await parseApiResponse<{ success: boolean; message: string; latency_ms: number }>(res);
      if (data.success) {
        toast.success('连接测试成功', { description: `延迟: ${data.latency_ms}ms` });
      } else {
        toast.error('连接测试失败', { description: data.message });
      }
    } catch (e: any) {
      toast.error('连接测试失败', { description: e.message });
    }
  };

  const handleRunSync = async (dsId?: string) => {
    const targetId = dsId || datasources?.[0]?.id;
    if (!targetId) {
      toast.error('没有可用的数据源，请先添加数据源');
      return;
    }
    setSyncing(targetId);
    setSyncProgress({ batches: 0, files: 0, records: 0 });
    try {
      const maxBatches = 50;
      let batches = 0;
      let totalFiles = 0;
      let totalRecords = 0;
      let hasMore = true;

      while (hasMore && batches < maxBatches) {
        const res = await apiFetch('/api/ingestion/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ datasource_id: targetId }),
        });
        const data = await parseApiResponse<{ success: boolean; message: string; filesProcessed: number; recordsIngested: number; hasMore: boolean }>(res);
        if (!data.success) {
          throw new Error(data.message);
        }

        batches++;
        totalFiles += data.filesProcessed;
        totalRecords += data.recordsIngested;
        hasMore = data.hasMore;
        setSyncProgress({ batches, files: totalFiles, records: totalRecords });

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      queryClient.invalidateQueries({ queryKey: ['ingestion', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['top'] });
      queryClient.invalidateQueries({ queryKey: ['timeseries'] });
      queryClient.invalidateQueries({ queryKey: ['status-codes'] });

      if (hasMore) {
        toast.warning('同步已暂停', { description: `已处理 ${batches} 批，${totalFiles} 文件，${totalRecords} 条记录。还有更多文件，请稍后继续。` });
      } else {
        toast.success('同步完成', { description: `${batches} 批, ${totalFiles} 文件, ${totalRecords} 条记录` });
      }
    } catch (e: any) {
      toast.error('同步失败', { description: e.message });
    } finally {
      setSyncing(null);
      setSyncProgress(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-bold text-foreground">数据源设置</h1>
        {activeTab === 'datasources' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            添加数据源
          </button>
        )}
        {activeTab === 'ingestion' && (
          <button
            onClick={() => handleRunSync()}
            disabled={syncing !== null}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
            {syncing ? '自动同步中...' : '自动同步'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('datasources')}
          className={cn(
            'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'datasources'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          数据源配置
        </button>
        <button
          onClick={() => setActiveTab('ingestion')}
          className={cn(
            'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'ingestion'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          同步状态
        </button>
      </div>

      {/* Data Sources Tab */}
      {activeTab === 'datasources' && (
        <div className="space-y-4">
          {/* Add Form */}
          {showAddForm && (
            <Panel title="添加数据源" className="animate-slide-in-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <FormField label="名称" placeholder="ESA 访问日志 - 生产" value={formData.name} onChange={v => updateField('name', v)} />
                <FormField label="Endpoint" placeholder="https://s3.cn-north-1.amazonaws.com.cn" value={formData.endpoint} onChange={v => updateField('endpoint', v)} />
                <FormField label="Bucket" placeholder="esa-logs-prod" value={formData.bucket} onChange={v => updateField('bucket', v)} />
                <FormField label="Region" placeholder="cn-north-1" value={formData.region} onChange={v => updateField('region', v)} />
                <FormField label="Access Key ID" placeholder="AKIAXXXXXXXXXXXXXXXX" value={formData.access_key_id} onChange={v => updateField('access_key_id', v)} />
                <FormField label="Secret Access Key" placeholder="****" type="password" value={formData.secret_access_key} onChange={v => updateField('secret_access_key', v)} />
                <FormField label="Prefix" placeholder="esa-logs/" value={formData.prefix} onChange={v => updateField('prefix', v)} />
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">文件格式</label>
                  <select
                    value={formData.format}
                    onChange={e => updateField('format', e.target.value)}
                    className="w-full h-8 mt-1 px-2 text-xs bg-secondary border border-border rounded-md text-foreground"
                  >
                    <option value="jsonl">JSON Lines</option>
                    <option value="json">JSON Array</option>
                    <option value="csv">CSV</option>
                    <option value="tsv">TSV</option>
                    <option value="gzip">Gzip</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">时区</label>
                  <select
                    value={formData.timezone}
                    onChange={e => updateField('timezone', e.target.value)}
                    className="w-full h-8 mt-1 px-2 text-xs bg-secondary border border-border rounded-md text-foreground"
                  >
                    <option value="Asia/Shanghai">Asia/Shanghai</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
                <button
                  onClick={handleTestConnection}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors"
                >
                  测试连接
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setFormData(initialFormData); }}
                  className="h-8 px-3 rounded-md text-xs bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </Panel>
          )}

          {/* Data Sources List */}
          {loadingDS ? (
            <div className="space-y-2">
              <div className="animate-pulse rounded-md bg-muted/50 h-20" />
              <div className="animate-pulse rounded-md bg-muted/50 h-20" />
            </div>
          ) : (
            (datasources || []).map(ds => (
              <div key={ds.id} className="rounded-md bg-card border border-border p-4 panel-glow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{ds.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {ds.endpoint} / {ds.bucket} / {ds.prefix}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        最后同步: {ds.last_sync_at ? new Date(ds.last_sync_at).toLocaleString('zh-CN') : '从未同步'}
                      </span>
                      <StatusBadge
                        label={ds.last_sync_status === 'success' ? '同步成功' : ds.last_sync_status === 'failed' ? '同步失败' : ds.last_sync_status === 'processing' ? '同步中' : '等待中'}
                        variant={ds.last_sync_status === 'success' ? 'success' : ds.last_sync_status === 'failed' ? 'destructive' : ds.last_sync_status === 'processing' ? 'info' : 'muted'}
                      />
                      <span className="text-[10px] text-muted-foreground">格式: {ds.format}</span>
                      <span className="text-[10px] text-muted-foreground">时区: {ds.timezone}</span>
                      {ds.stats && (
                        <span className="text-[10px] text-muted-foreground">
                          已入库: {ds.stats.files} 文件 / {ds.stats.logs.toLocaleString()} 条
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRunSync(ds.id)}
                    disabled={syncing !== null}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <RefreshCw className={cn('w-3 h-3', syncing === ds.id && 'animate-spin')} />
                    {syncing === ds.id ? '自动同步中' : '同步'}
                  </button>
                </div>
                {syncing === ds.id && syncProgress && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>批次: {syncProgress.batches}</span>
                    <span>文件: {syncProgress.files}</span>
                    <span>记录: {syncProgress.records.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Ingestion Tab */}
      {activeTab === 'ingestion' && (
        <Panel title="同步文件状态" subtitle={`最近处理的日志文件${ingestionFiles ? ` · 共 ${ingestionFiles.length} 个文件` : ''}`}>
          {loadingIngestion ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-md bg-muted/50 h-12" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">文件</th>
                    <th className="text-left py-2 px-2 font-medium">大小</th>
                    <th className="text-left py-2 px-2 font-medium">状态</th>
                    <th className="text-right py-2 px-2 font-medium">记录数</th>
                    <th className="text-right py-2 px-2 font-medium">错误</th>
                    <th className="text-left py-2 px-2 font-medium">处理时间</th>
                  </tr>
                </thead>
                <tbody>
                  {(ingestionFiles || []).map(f => (
                    <tr key={f.object_key} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                      <td className="py-2 px-2 text-mono text-foreground truncate max-w-[250px]" title={f.object_key}>
                        {f.object_key}
                      </td>
                      <td className="py-2 px-2 text-mono text-muted-foreground">
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </td>
                      <td className="py-2 px-2">
                        {f.status === 'success' && (
                          <span className="flex items-center gap-1 text-success">
                            <CheckCircle className="w-3 h-3" /> 成功
                          </span>
                        )}
                        {f.status === 'failed' && (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="w-3 h-3" /> 失败
                          </span>
                        )}
                        {f.status === 'processing' && (
                          <span className="flex items-center gap-1 text-info">
                            <Loader2 className="w-3 h-3 animate-spin" /> 处理中
                          </span>
                        )}
                        {f.status === 'pending' && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" /> 等待中
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-mono text-right">{f.record_count.toLocaleString()}</td>
                      <td className="py-2 px-2 text-mono text-right">
                        {f.error_count > 0 ? (
                          <span className="text-warning">{f.error_count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-mono text-muted-foreground">
                        {f.started_at ? new Date(f.started_at).toLocaleString('zh-CN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function FormField({ label, placeholder, type = 'text', value, onChange }: { label: string; placeholder: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-8 mt-1 px-3 text-xs bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
