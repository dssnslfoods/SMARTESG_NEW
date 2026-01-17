import { useLanguage } from "@/contexts/LanguageContext";
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart2, ArrowRight, Activity, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

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
  /** Which metric to analyze for MoM/QoQ/YoY/YTD/Trend. Defaults to records. */
  measure?: "records" | "totalValue" | "avgValue";
  /** Optional unit label for value-based measures (e.g., kg, tCO2e). */
  unitLabel?: string;
}

interface AnalyticsResult {
  value: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  isNeutral: boolean;
}

export function TrendAnalytics({
  trendData,
  color = "hsl(var(--primary))",
  compact = false,
  measure = "records",
  unitLabel,
}: TrendAnalyticsProps) {
  const { language } = useLanguage();

  if (trendData.length < 2) {
    return null;
  }

  const getValue = (d: TrendDataPoint | undefined) => {
    if (!d) return 0;
    const v = d[measure];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };

  const valueNoun = unitLabel ? unitLabel : (language === "th" ? "รายการ" : "records");

  // Get current month data (last in array)
  const currentData = trendData[trendData.length - 1];
  const previousData = trendData[trendData.length - 2];

  // Calculate MoM (Month over Month)
  const calculateMoM = (): AnalyticsResult => {
    const current = getValue(currentData);
    const previous = getValue(previousData);

    const change = current - previous;
    const changePercent = previous > 0
      ? Math.round((change / previous) * 100)
      : current > 0 ? 100 : 0;

    return {
      value: current,
      change,
      changePercent,
      isPositive: change > 0,
      isNeutral: change === 0,
    };
  };

  // Calculate QoQ (Quarter over Quarter) - compare last 3 points vs previous 3 points
  const calculateQoQ = (): AnalyticsResult | null => {
    if (trendData.length < 6) return null;

    const lastQuarter = trendData.slice(-3);
    const previousQuarter = trendData.slice(-6, -3);

    const lastQuarterTotal = lastQuarter.reduce((sum, d) => sum + getValue(d), 0);
    const prevQuarterTotal = previousQuarter.reduce((sum, d) => sum + getValue(d), 0);

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

  // Calculate YoY (Year over Year) - compare same month last year
  const calculateYoY = (): AnalyticsResult | null => {
    if (!currentData) return null;

    const sameMonthLastYear = trendData.find(
      (d) => d.month === currentData.month && d.year === currentData.year - 1
    );

    if (!sameMonthLastYear) return null;

    const current = getValue(currentData);
    const previous = getValue(sameMonthLastYear);

    const change = current - previous;
    const changePercent = previous > 0
      ? Math.round((change / previous) * 100)
      : current > 0 ? 100 : 0;

    return {
      value: current,
      change,
      changePercent,
      isPositive: change > 0,
      isNeutral: change === 0,
    };
  };

  // Calculate YTD (Year to Date) total
  const calculateYTD = (): {
    total: number;
    avgPerMonth: number;
    peakMonth: string;
    peakValue: number;
    monthCount: number;
  } => {
    const latestYear = Math.max(...trendData.map((d) => d.year));
    const ytdData = trendData.filter((d) => d.year === latestYear);

    const total = ytdData.reduce((sum, d) => sum + getValue(d), 0);
    const avgPerMonth = ytdData.length > 0 ? Math.round((total / ytdData.length) * 100) / 100 : 0;

    const peakData = ytdData.reduce(
      (max, d) => (getValue(d) > getValue(max) ? d : max),
      ytdData[0] || ({ name: "-", records: 0, totalValue: 0, avgValue: 0, submitted: 0, month: 1, year: latestYear } as TrendDataPoint)
    );

    return {
      total,
      avgPerMonth,
      peakMonth: peakData?.name || "-",
      peakValue: getValue(peakData),
      monthCount: ytdData.length,
    };
  };

  // Calculate growth trend (overall trend direction)
  const calculateTrend = (): { direction: "up" | "down" | "stable"; strength: number } => {
    if (trendData.length < 3) return { direction: "stable", strength: 0 };

    const n = trendData.length;
    const xSum = trendData.reduce((sum, _, i) => sum + i, 0);
    const ySum = trendData.reduce((sum, d) => sum + getValue(d), 0);
    const xySum = trendData.reduce((sum, d, i) => sum + i * getValue(d), 0);
    const x2Sum = trendData.reduce((sum, _, i) => sum + i * i, 0);

    const denominator = (n * x2Sum - xSum * xSum);
    if (denominator === 0) return { direction: "stable", strength: 0 };

    const slope = (n * xySum - xSum * ySum) / denominator;
    const avg = ySum / n;
    const strength = avg > 0 ? Math.abs(Math.round((slope / avg) * 100)) : 0;

    return {
      direction: slope > 0.0001 ? "up" : slope < -0.0001 ? "down" : "stable",
      strength: Math.min(strength, 100),
    };
  };

  const mom = calculateMoM();
  const qoq = calculateQoQ();
  const yoy = calculateYoY();
  const ytd = calculateYTD();
  const trend = calculateTrend();

  const TrendIcon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;

  // Helper component for metric display
  const MetricBadge = ({ 
    result, 
    label,
    showValue = false 
  }: { 
    result: AnalyticsResult | null; 
    label: string;
    showValue?: boolean;
  }) => {
    if (!result) return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">-</span>
      </div>
    );

    return (
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full",
        result.isNeutral ? "bg-muted/50" : result.isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"
      )}>
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        <span className={cn(
          "text-[10px] font-semibold flex items-center gap-0.5",
          result.isNeutral ? "text-muted-foreground" : result.isPositive ? "text-emerald-600" : "text-rose-600"
        )}>
          {result.isNeutral ? (
            <Minus className="h-2.5 w-2.5" />
          ) : result.isPositive ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5" />
          )}
          {result.isNeutral ? "0%" : `${result.isPositive ? "+" : ""}${result.changePercent}%`}
        </span>
      </div>
    );
  };

  if (compact) {
    // Compact view for theme cards
    return (
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-border/50">
        <MetricBadge result={mom} label="MoM" />
        {qoq && <MetricBadge result={qoq} label="QoQ" />}
        {yoy && <MetricBadge result={yoy} label="YoY" />}
        
        {/* YTD Badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10">
          <span className="text-[10px] text-muted-foreground font-medium">YTD</span>
          <span className="text-[10px] font-semibold text-primary">{ytd.total}</span>
        </div>

        {/* Trend Indicator */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full",
          trend.direction === "up" ? "bg-emerald-500/10" : 
          trend.direction === "down" ? "bg-rose-500/10" : 
          "bg-muted/50"
        )}>
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

  // Full view for drilldown dialog - Beautiful card layout
  return (
    <div className="space-y-4">
      {/* Main Analytics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* MoM Card */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4">
          <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full bg-primary/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "p-1.5 rounded-lg",
                mom.isNeutral ? "bg-muted" : mom.isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"
              )}>
                <Calendar className={cn(
                  "h-4 w-4",
                  mom.isNeutral ? "text-muted-foreground" : mom.isPositive ? "text-emerald-600" : "text-rose-600"
                )} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                MoM
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {mom.isNeutral ? (
                <Minus className="h-5 w-5 text-muted-foreground" />
              ) : mom.isPositive ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-rose-600" />
              )}
              <span className={cn(
                "text-2xl font-bold tracking-tight",
                mom.isNeutral ? "text-muted-foreground" : mom.isPositive ? "text-emerald-600" : "text-rose-600"
              )}>
                {mom.isNeutral ? "0" : `${mom.isPositive ? "+" : ""}${mom.changePercent}`}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              {previousData?.name} <ArrowRight className="h-2.5 w-2.5" /> {currentData?.name}
            </p>
          </div>
        </div>

        {/* QoQ Card */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4">
          <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full bg-primary/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "p-1.5 rounded-lg",
                !qoq || qoq.isNeutral ? "bg-muted" : qoq.isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"
              )}>
                <BarChart2 className={cn(
                  "h-4 w-4",
                  !qoq || qoq.isNeutral ? "text-muted-foreground" : qoq.isPositive ? "text-emerald-600" : "text-rose-600"
                )} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                QoQ
              </span>
            </div>
            {qoq ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  {qoq.isNeutral ? (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  ) : qoq.isPositive ? (
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                  )}
                  <span className={cn(
                    "text-2xl font-bold tracking-tight",
                    qoq.isNeutral ? "text-muted-foreground" : qoq.isPositive ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {qoq.isNeutral ? "0" : `${qoq.isPositive ? "+" : ""}${qoq.changePercent}`}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {language === "th" ? "เทียบไตรมาสก่อน" : "vs. previous quarter"}
                </p>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-muted-foreground">-</span>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {language === "th" ? "ข้อมูลไม่เพียงพอ" : "Insufficient data"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* YoY Card */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4">
          <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full bg-primary/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "p-1.5 rounded-lg",
                !yoy || yoy.isNeutral ? "bg-muted" : yoy.isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"
              )}>
                <Activity className={cn(
                  "h-4 w-4",
                  !yoy || yoy.isNeutral ? "text-muted-foreground" : yoy.isPositive ? "text-emerald-600" : "text-rose-600"
                )} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                YoY
              </span>
            </div>
            {yoy ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  {yoy.isNeutral ? (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  ) : yoy.isPositive ? (
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                  )}
                  <span className={cn(
                    "text-2xl font-bold tracking-tight",
                    yoy.isNeutral ? "text-muted-foreground" : yoy.isPositive ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {yoy.isNeutral ? "0" : `${yoy.isPositive ? "+" : ""}${yoy.changePercent}`}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {language === "th" ? "เทียบปีก่อน" : "vs. same month last year"}
                </p>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-muted-foreground">-</span>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {language === "th" ? "ไม่มีข้อมูลปีก่อน" : "No prior year data"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* YTD Card */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
          <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full bg-primary/10" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/20">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                YTD
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight" style={{ color }}>
                {ytd.total.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                {valueNoun}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {language === "th" ? `เฉลี่ย ${ytd.avgPerMonth.toLocaleString()} ต่อเดือน` : `Avg ${ytd.avgPerMonth.toLocaleString()} per month`}
            </p>
          </div>
        </div>

        {/* Overall Trend Card */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4">
          <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full bg-primary/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "p-1.5 rounded-lg",
                trend.direction === "up" ? "bg-emerald-500/10" : 
                trend.direction === "down" ? "bg-rose-500/10" : 
                "bg-muted"
              )}>
                <TrendIcon className={cn(
                  "h-4 w-4",
                  trend.direction === "up" ? "text-emerald-600" : 
                  trend.direction === "down" ? "text-rose-600" : 
                  "text-muted-foreground"
                )} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {language === "th" ? "แนวโน้ม" : "Trend"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                "text-lg font-bold tracking-tight",
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
            <p className="text-[11px] text-muted-foreground mt-1">
              {language === "th" ? `สูงสุด: ${ytd.peakMonth}` : `Peak: ${ytd.peakMonth}`}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {language === "th" ? "ข้อมูลทั้งหมด:" : "Total Data:"}
            </span>
            <span className="text-sm font-semibold" style={{ color }}>
              {trendData.reduce((sum, d) => sum + getValue(d), 0).toLocaleString()} {valueNoun}
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {language === "th" ? "ช่วงเวลา:" : "Period:"}
            </span>
            <span className="text-sm font-medium">
              {trendData[0]?.name} - {currentData?.name}
            </span>
          </div>
        </div>
        
        {/* Trend Strength Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {language === "th" ? "ความแรงของแนวโน้ม:" : "Trend Strength:"}
          </span>
          <div className="flex items-center gap-2 min-w-[100px]">
            <Progress 
              value={trend.strength} 
              className="h-1.5 w-16"
            />
            <span className="text-xs font-medium">{trend.strength}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
