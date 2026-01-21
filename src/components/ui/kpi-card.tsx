import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";

export interface KPICardProps {
  /** Card title/label */
  title: string;
  /** Main display value */
  value: number | string;
  /** Unit of measurement (optional) */
  unit?: string;
  /** Icon to display */
  icon: ReactNode;
  /** Trend direction */
  trend: "up" | "down" | "stable";
  /** Trend percentage value */
  trendValue: number;
  /** 
   * Context for trend color interpretation
   * - 'positive': up is green, down is red (e.g., revenue, score)
   * - 'negative': down is green, up is red (e.g., emissions, costs)
   */
  trendContext?: "positive" | "negative";
  /** Data points for sparkline mini chart */
  sparklineData?: number[];
  /** Sparkline color (defaults to primary) */
  sparklineColor?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
  /** Icon background color */
  iconBgColor?: string;
  /** Icon color */
  iconColor?: string;
}

// Sparkline component
const Sparkline = ({ 
  data, 
  color = "hsl(var(--primary))" 
}: { 
  data: number[]; 
  color?: string;
}) => {
  const sparkData = data.map((value, index) => ({ value, index }));
  
  return (
    <div className="h-10 w-full mt-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sparkData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export function KPICard({
  title,
  value,
  unit,
  icon,
  trend,
  trendValue,
  trendContext = "positive",
  sparklineData,
  sparklineColor,
  onClick,
  className,
  iconBgColor = "hsl(var(--primary) / 0.1)",
  iconColor = "hsl(var(--primary))",
}: KPICardProps) {
  // Determine trend color based on context
  const getTrendColor = () => {
    if (trend === "stable") return "text-muted-foreground";
    
    if (trendContext === "positive") {
      // Positive context: up is good (green), down is bad (red)
      return trend === "up" ? "text-emerald-600" : "text-destructive";
    } else {
      // Negative context: down is good (green), up is bad (red)
      return trend === "down" ? "text-emerald-600" : "text-destructive";
    }
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = getTrendColor();

  // Format trend value
  const formattedTrend = `${trend === "up" ? "+" : trend === "down" ? "-" : ""}${Math.abs(trendValue)}%`;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl"
            style={{ backgroundColor: iconBgColor }}
          >
            <div style={{ color: iconColor }}>{icon}</div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {title}
            </p>

            {/* Value */}
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl sm:text-2xl font-bold text-foreground">
                {typeof value === "number" ? value.toLocaleString() : value}
              </span>
              {unit && (
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {unit}
                </span>
              )}
            </div>

            {/* Trend */}
            <div className={cn("flex items-center gap-1 mt-1", trendColor)}>
              <TrendIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="text-xs sm:text-sm font-medium">
                {formattedTrend}
              </span>
            </div>
          </div>
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <Sparkline 
            data={sparklineData} 
            color={sparklineColor || iconColor} 
          />
        )}

        {/* Clickable indicator */}
        {onClick && (
          <div className="absolute top-2 right-2">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for grids
export function KPICardCompact({
  title,
  value,
  unit,
  icon,
  trend,
  trendValue,
  trendContext = "positive",
  onClick,
  className,
  iconColor = "hsl(var(--primary))",
}: Omit<KPICardProps, "sparklineData" | "sparklineColor" | "iconBgColor">) {
  const getTrendColor = () => {
    if (trend === "stable") return "text-muted-foreground";
    if (trendContext === "positive") {
      return trend === "up" ? "text-emerald-600" : "text-destructive";
    } else {
      return trend === "down" ? "text-emerald-600" : "text-destructive";
    }
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = getTrendColor();
  const formattedTrend = `${trend === "up" ? "+" : trend === "down" ? "-" : ""}${Math.abs(trendValue)}%`;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <div style={{ color: iconColor }}>{icon}</div>
          <p className="text-xs text-muted-foreground truncate">{title}</p>
        </div>
        
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-bold">
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
            {unit && (
              <span className="text-xs text-muted-foreground">{unit}</span>
            )}
          </div>
          
          <div className={cn("flex items-center gap-0.5", trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span className="text-xs font-medium">{formattedTrend}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default KPICard;
