import * as React from "react";
import { Progress } from "./progress";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProgressProps {
  loaded: number;
  total: number | null;
  isLoading: boolean;
  className?: string;
  showPercentage?: boolean;
  showCounts?: boolean;
  label?: string;
}

export function LoadingProgress({
  loaded,
  total,
  isLoading,
  className,
  showPercentage = true,
  showCounts = true,
  label = "กำลังโหลดข้อมูล",
}: LoadingProgressProps) {
  if (!isLoading) return null;

  const percentage = total ? Math.round((loaded / total) * 100) : 0;
  const hasKnownTotal = total !== null && total > 0;

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{label}</span>
        </div>
        {hasKnownTotal && showPercentage && (
          <span className="font-medium text-primary">{percentage}%</span>
        )}
      </div>
      
      {hasKnownTotal ? (
        <Progress value={percentage} className="h-2" />
      ) : (
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/3 animate-pulse bg-primary/50 rounded-full" />
        </div>
      )}
      
      {hasKnownTotal && showCounts && (
        <p className="text-xs text-muted-foreground text-center">
          {loaded.toLocaleString()} / {total.toLocaleString()} รายการ
        </p>
      )}
    </div>
  );
}

/**
 * Full-page loading overlay with progress
 */
interface LoadingOverlayProps {
  loaded: number;
  total: number | null;
  isLoading: boolean;
  message?: string;
}

export function LoadingOverlay({
  loaded,
  total,
  isLoading,
  message = "กำลังโหลดข้อมูล ESG",
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  const percentage = total ? Math.round((loaded / total) * 100) : 0;
  const hasKnownTotal = total !== null && total > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 p-6 rounded-xl bg-card border shadow-lg space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <h3 className="text-lg font-medium">{message}</h3>
        </div>
        
        {hasKnownTotal ? (
          <>
            <Progress value={percentage} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{loaded.toLocaleString()} / {total.toLocaleString()} รายการ</span>
              <span className="font-medium text-primary">{percentage}%</span>
            </div>
          </>
        ) : (
          <>
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div 
                className="h-full bg-primary/70 rounded-full animate-progress-indeterminate"
                style={{ width: '30%' }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              กำลังเตรียมข้อมูล...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Inline compact loading progress
 */
interface InlineProgressProps {
  loaded: number;
  total: number | null;
  isLoading: boolean;
}

export function InlineProgress({ loaded, total, isLoading }: InlineProgressProps) {
  if (!isLoading || loaded === 0) return null;

  const percentage = total ? Math.round((loaded / total) * 100) : 0;
  const hasKnownTotal = total !== null && total > 0;

  return (
    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      {hasKnownTotal ? (
        <span>โหลด {percentage}% ({loaded.toLocaleString()} รายการ)</span>
      ) : (
        <span>กำลังโหลด... ({loaded.toLocaleString()} รายการ)</span>
      )}
    </div>
  );
}
