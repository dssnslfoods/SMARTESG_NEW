import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type MetricStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

interface StatusBadgeProps {
  status: MetricStatus | string;
  className?: string;
}

export const STATUS_STYLES: Record<MetricStatus, string> = {
  draft:     'bg-amber-100 text-amber-700 border-amber-200',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  approved:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected:  'bg-red-100 text-red-700 border-red-200',
};

export const STATUS_LABELS: Record<MetricStatus, { th: string; en: string }> = {
  draft:     { th: 'ร่าง',         en: 'Draft' },
  submitted: { th: 'รออนุมัติ',    en: 'Pending Approval' },
  approved:  { th: 'อนุมัติแล้ว',  en: 'Approved' },
  rejected:  { th: 'ถูกปฏิเสธ',    en: 'Rejected' },
};

export function statusLabel(status: string, language: 'th' | 'en') {
  return STATUS_LABELS[status as MetricStatus]?.[language] || status;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { language } = useLanguage();
  const s = status as MetricStatus;

  return (
    <Badge variant="outline" className={cn('rounded-full px-3', STATUS_STYLES[s] ?? 'bg-muted text-muted-foreground', className)}>
      {statusLabel(status, language)}
    </Badge>
  );
}
