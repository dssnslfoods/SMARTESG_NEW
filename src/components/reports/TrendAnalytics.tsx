import { useLanguage } from "@/contexts/LanguageContext";
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendDataPoint {
  name: string;
  month: number;
  year: number;
  records: number;
  totalValue: number;
  avgValue: number;
  submitted: number;
}

interface TrendAnalyticsProps {
  trendData: TrendDataPoint[];
  color?: string;
  compact?: boolean;
}

interface AnalyticsResult {
  value: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  isNeutral: boolean;
}

export function TrendAnalytics({ trendData, color = "hsl(var(--primary))", compact = false }: TrendAnalyticsProps) {
  const { language } = useLanguage();

  if (trendData.length < 2) {
    return null;
  }

  // Get current month data (last in array)
  const currentData = trendData[trendData.length - 1];
  const previousData = trendData[trendData.length - 2];

  // Calculate MoM (Month over Month)
  const calculateMoM = (): AnalyticsResult => {
    if (!currentData || !previousData) {
      return { value: 0, change: 0, changePercent: 0, isPositive: false, isNeutral: true };
    }
    const change = currentData.records - previousData.records;
    const changePercent = previousData.records > 0 
      ? Math.round((change / previousData.records) * 100) 
      : currentData.records > 0 ? 100 : 0;
    return {
      value: currentData.records,
      change,
      changePercent,
      isPositive: change > 0,
      isNeutral: change === 0,
    };
  };

  // Calculate QoQ (Quarter over Quarter) - compare last 3 months vs previous 3 months
  const calculateQoQ = (): AnalyticsResult | null => {
    if (trendData.length < 6) return null;

    const lastQuarter = trendData.slice(-3);
    const previousQuarter = trendData.slice(-6, -3);

    const lastQuarterTotal = lastQuarter.reduce((sum, d) => sum + d.records, 0);
    const prevQuarterTotal = previousQuarter.reduce((sum, d) => sum + d.records, 0);

    const change = lastQuarterTotal - prevQuarterTotal;
    const changePercent = prevQuarterTotal > 0 
      ? Math.round((change / prevQuarterTotal) * 100) 
      : lastQuarterTotal > 0 ? 100 : 0;

    return {
      value: lastQuarterTotal,
      change,
      changePercent,
      isPositive: change > 0,
      isNeutral: change === 0,
    };
  };

  // Calculate YTD (Year to Date) total
  const calculateYTD = (): { total: number; avgPerMonth: number; peakMonth: string; peakValue: number } => {
    // Get unique years and find the current/latest year
    const latestYear = Math.max(...trendData.map(d => d.year));
    const ytdData = trendData.filter(d => d.year === latestYear);
    
    const total = ytdData.reduce((sum, d) => sum + d.records, 0);
    const avgPerMonth = ytdData.length > 0 ? Math.round(total / ytdData.length) : 0;
    
    // Find peak month
    const peakData = ytdData.reduce((max, d) => d.records > max.records ? d : max, ytdData[0] || { name: "-", records: 0 });
    
    return {
      total,
      avgPerMonth,
      peakMonth: peakData?.name || "-",
      peakValue: peakData?.records || 0,
    };
  };

  // Calculate growth trend (overall trend direction)
  const calculateTrend = (): { direction: "up" | "down" | "stable"; strength: number } => {
    if (trendData.length < 3) return { direction: "stable", strength: 0 };

    // Simple linear regression to determine trend
    const n = trendData.length;
    const xSum = trendData.reduce((sum, _, i) => sum + i, 0);
    const ySum = trendData.reduce((sum, d) => sum + d.records, 0);
    const xySum = trendData.reduce((sum, d, i) => sum + i * d.records, 0);
    const x2Sum = trendData.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const avgValue = ySum / n;
    const strength = avgValue > 0 ? Math.abs(Math.round((slope / avgValue) * 100)) : 0;

    return {
      direction: slope > 0.1 ? "up" : slope < -0.1 ? "down" : "stable",
      strength: Math.min(strength, 100),
    };
  };

  const mom = calculateMoM();
  const qoq = calculateQoQ();
  const ytd = calculateYTD();
  const trend = calculateTrend();

  const TrendIcon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;

  if (compact) {
    // Compact view for theme cards
    return (
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        {/* MoM */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">MoM</span>
          <span className={cn(
            "text-[10px] font-semibold flex items-center gap-0.5",
            mom.isNeutral ? "text-muted-foreground" : mom.isPositive ? "text-emerald-600" : "text-rose-600"
          )}>
            {mom.isNeutral ? (
              <Minus className="h-2.5 w-2.5" />
            ) : mom.isPositive ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {mom.isNeutral ? "0%" : `${mom.isPositive ? "+" : ""}${mom.changePercent}%`}
          </span>
        </div>

        {/* YTD */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">YTD</span>
          <span className="text-[10px] font-semibold text-foreground">{ytd.total}</span>
        </div>

        {/* Trend */}
        <div className="flex items-center gap-1">
          <TrendIcon 
            className={cn(
              "h-3 w-3",
              trend.direction === "up" ? "text-emerald-600" : 
              trend.direction === "down" ? "text-rose-600" : 
              "text-muted-foreground"
            )} 
          />
        </div>
      </div>
    );
  }

  // Full view for drilldown dialog
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg border">
      {/* MoM */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>MoM</span>
        </div>
        <div className="flex items-center gap-1">
          {mom.isNeutral ? (
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          ) : mom.isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
          )}
          <span className={cn(
            "text-sm font-semibold",
            mom.isNeutral ? "text-muted-foreground" : mom.isPositive ? "text-emerald-600" : "text-rose-600"
          )}>
            {mom.isNeutral ? "0%" : `${mom.isPositive ? "+" : ""}${mom.changePercent}%`}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {previousData?.name} <ArrowRight className="h-2 w-2 inline" /> {currentData?.name}
        </p>
      </div>

      {/* QoQ */}
      {qoq ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart2 className="h-3 w-3" />
            <span>QoQ</span>
          </div>
          <div className="flex items-center gap-1">
            {qoq.isNeutral ? (
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            ) : qoq.isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
            )}
            <span className={cn(
              "text-sm font-semibold",
              qoq.isNeutral ? "text-muted-foreground" : qoq.isPositive ? "text-emerald-600" : "text-rose-600"
            )}>
              {qoq.isNeutral ? "0%" : `${qoq.isPositive ? "+" : ""}${qoq.changePercent}%`}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {language === "th" ? "เทียบไตรมาสก่อน" : "vs. prev quarter"}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart2 className="h-3 w-3" />
            <span>QoQ</span>
          </div>
          <span className="text-sm text-muted-foreground">-</span>
          <p className="text-[10px] text-muted-foreground">
            {language === "th" ? "ข้อมูลไม่เพียงพอ" : "Insufficient data"}
          </p>
        </div>
      )}

      {/* YTD */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>YTD</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold" style={{ color }}>
            {ytd.total}
          </span>
          <span className="text-xs text-muted-foreground">
            {language === "th" ? "รายการ" : "records"}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {language === "th" ? `เฉลี่ย ${ytd.avgPerMonth}/เดือน` : `Avg ${ytd.avgPerMonth}/month`}
        </p>
      </div>

      {/* Trend & Peak */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendIcon className="h-3 w-3" />
          <span>{language === "th" ? "แนวโน้ม" : "Trend"}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendIcon 
            className={cn(
              "h-3.5 w-3.5",
              trend.direction === "up" ? "text-emerald-600" : 
              trend.direction === "down" ? "text-rose-600" : 
              "text-muted-foreground"
            )} 
          />
          <span className={cn(
            "text-sm font-semibold",
            trend.direction === "up" ? "text-emerald-600" : 
            trend.direction === "down" ? "text-rose-600" : 
            "text-muted-foreground"
          )}>
            {trend.direction === "up" 
              ? (language === "th" ? "เพิ่มขึ้น" : "Growing")
              : trend.direction === "down" 
                ? (language === "th" ? "ลดลง" : "Declining")
                : (language === "th" ? "คงที่" : "Stable")
            }
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {language === "th" ? `สูงสุด: ${ytd.peakMonth}` : `Peak: ${ytd.peakMonth}`}
        </p>
      </div>
    </div>
  );
}
