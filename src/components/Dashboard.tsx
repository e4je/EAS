import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; label: string };
  icon?: ReactNode;
  color?: string;
  className?: string;
}

export function MetricCard({ title, value, subtitle, trend, icon, color, className }: MetricCardProps) {
  return (
    <div className={cn('rounded-md bg-card border border-border p-4 panel-glow', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
          <p className={cn('text-2xl font-display font-bold tracking-tight truncate', color)}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {icon && (
          <div className="shrink-0 w-8 h-8 rounded-md bg-secondary flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-success' : 'text-destructive')}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

interface PanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function Panel({ title, subtitle, children, className, actions }: PanelProps) {
  return (
    <div className={cn('rounded-md bg-card border border-border panel-glow', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

interface StatusBadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'destructive' | 'info' | 'muted';
  size?: 'sm' | 'xs';
}

export function StatusBadge({ label, variant = 'muted', size = 'xs' }: StatusBadgeProps) {
  const variants = {
    success: 'bg-success/15 text-success border-success/20',
    warning: 'bg-warning/15 text-warning border-warning/20',
    destructive: 'bg-destructive/15 text-destructive border-destructive/20',
    info: 'bg-info/15 text-info border-info/20',
    muted: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-sm border font-medium',
      variants[variant],
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
    )}>
      {label}
    </span>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted/50', className)} {...props} />
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
    </div>
  );
}
