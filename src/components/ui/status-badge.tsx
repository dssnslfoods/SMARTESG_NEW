import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type Status = 'draft' | 'submitted' | 'approved' | 'rejected';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusStyles: Record<Status, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/10 text-primary border-primary/20',
  approved: 'bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useLanguage();
  
  return (
    <Badge variant="outline" className={cn(statusStyles[status], className)}>
      {t(status)}
    </Badge>
  );
}
