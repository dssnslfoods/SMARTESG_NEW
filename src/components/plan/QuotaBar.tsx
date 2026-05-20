/**
 * QuotaBar — shows used/limit for a resource (users, sites, etc.)
 * Used inside management pages to warn when approaching or reaching limits.
 */
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface QuotaBarProps {
  resource: 'users' | 'sites' | 'companies' | 'metrics';
  current: number;
  className?: string;
}

const RESOURCE_LABEL: Record<QuotaBarProps['resource'], { th: string; en: string }> = {
  users:     { th: 'ผู้ใช้งาน', en: 'Users' },
  sites:     { th: 'สถานที่', en: 'Sites' },
  companies: { th: 'บริษัท', en: 'Companies' },
  metrics:   { th: 'ตัวชี้วัด', en: 'Metrics' },
};

export function QuotaBar({ resource, current, className }: QuotaBarProps) {
  const { isSuperAdmin } = useAuth();
  const { limits, loading } = usePlanLimits();
  const { language } = useLanguage();
  const th = language === 'th';

  if (loading || isSuperAdmin || !limits) return null;

  const limitMap: Record<typeof resource, number> = {
    users:     limits.max_users,
    sites:     limits.max_sites,
    companies: limits.max_companies,
    metrics:   limits.max_metrics,
  };

  const max = limitMap[resource];
  if (max === -1) return null; // unlimited — no bar needed

  const pct = Math.min(100, Math.round((current / max) * 100));
  const isNear = pct >= 80;
  const isFull = current >= max;

  const label = RESOURCE_LABEL[resource][th ? 'th' : 'en'];

  return (
    <div className={cn('flex items-center gap-3 text-xs', className)}>
      <span className="w-20 shrink-0 text-right text-gray-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isFull ? 'bg-red-500' : isNear ? 'bg-amber-400' : 'bg-emerald-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('w-16 shrink-0 font-medium', isFull ? 'text-red-600' : isNear ? 'text-amber-600' : 'text-gray-600')}>
        {current} / {max}
      </span>
    </div>
  );
}
