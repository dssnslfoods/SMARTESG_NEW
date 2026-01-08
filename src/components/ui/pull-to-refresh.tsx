import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const shouldShow = pullDistance > 10 || isRefreshing;

  if (!shouldShow) return null;

  return (
    <div
      className="flex items-center justify-center transition-all duration-200 ease-out overflow-hidden"
      style={{ height: pullDistance }}
    >
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full bg-background border border-border shadow-sm transition-transform duration-200",
          isRefreshing && "animate-pulse"
        )}
        style={{
          transform: `rotate(${progress * 180}deg) scale(${0.5 + progress * 0.5})`,
          opacity: Math.min(progress * 1.5, 1),
        }}
      >
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        ) : (
          <ArrowDown 
            className={cn(
              "h-5 w-5 transition-colors duration-200",
              progress >= 1 ? "text-primary" : "text-muted-foreground"
            )} 
          />
        )}
      </div>
    </div>
  );
}
