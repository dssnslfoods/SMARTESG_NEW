import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type Status = 'draft' | 'submitted';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusStyles: Record<Status, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/10 text-primary border-primary/20',
};

const statusLabels: Record<Status, { th: string; en: string }> = {
  draft: { th: 'ร่าง', en: 'Draft' },
  submitted: { th: 'ส่งแล้ว', en: 'Submitted' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { language } = useLanguage();
  
  return (
    <Badge variant="outline" className={cn(statusStyles[status], className)}>
      {statusLabels[status]?.[language] || status}
    </Badge>
  );
}
