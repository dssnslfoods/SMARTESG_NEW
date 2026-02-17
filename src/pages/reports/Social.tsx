import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  Heart,
  GraduationCap,
  ShieldCheck,
  Smile,
  BarChart3,
  AlertTriangle,
  Clock,
  PackageOpen,
  Scale,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh";
import { ReportsLoadingSkeleton } from "@/components/ui/loading-skeleton";

// ─── Metric ID Constants ───
const METRIC = {
  TRAINING_HOURS: "MET008",       // ชั่วโมงอบรมรวม
  LTI: "MET009",                   // Lost Time Injury
  WELLBEING_ACCESS: "MET010",      // พนักงานเข้าถึง Well-being
  NPD_HEALTH: "MET016",           // NPD กลุ่มสุขภาพ
  HUMAN_RIGHTS_VIOLATIONS: "MET017", // ละเมิดสิทธิมนุษยชน
  FOOD_DONATION: "MET020",         // บริจาคอาหาร
  WORKING_HOURS: "MET035",         // ชั่วโมงทำงาน
};

const SOCIAL_METRIC_IDS = Object.values(METRIC);

// ─── Interfaces ───
interface Company { company_id: string; company_name: string; }
interface Site { site_id: string; site_name: string; company_id: string; }
interface ReportingPeriod { period_id: string; year: number; month: number; month_name: string; }
interface EsgMetric { metric_id: string; metric_name: string; theme_id: string; unit: string | null; }
interface MetricValue {
  value_id: string; metric_id: string; site_id: string; period_id: string;
  value: number; status: string;
}

// ─── Shared Components ───
const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
    <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
    <p>{message}</p>
  </div>
);

const glassTooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(229, 231, 235, 0.5)",
  borderRadius: "12px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
};

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  if (data.length === 0) return <div className="h-8 w-20 flex items-center justify-center text-xs text-muted-foreground">-</div>;
  const sparkData = data.map((value, index) => ({ value, index }));
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sparkData}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── KPI Card ───
const SocialKPICard = ({
  title, value, unit, icon: Icon, trend, trendValue, trendContext, sparklineData, color,
}: {
  title: string; value: string | number | null; unit: string; icon: React.ElementType;
  trend?: "up" | "down" | "neutral" | null; trendValue?: string | null;
  trendContext?: "positive" | "negative"; // positive=up is green, negative=down is green
  sparklineData: number[]; color: string;
}) => {
  const context = trendContext || "positive";
  const getTrendColor = () => {
    if (!trend || trend === "neutral") return "text-muted-foreground";
    if (context === "positive") return trend === "up" ? "text-emerald-600" : "text-destructive";
    return trend === "down" ? "text-emerald-600" : "text-destructive";
  };

  return (
    <Card className="flex-1 min-w-[220px] bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}20` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <p className="text-xs text-muted-foreground">{title}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold">{value !== null ? value : "-"}</span>
              {value !== null && <span className="text-xs text-muted-foreground">{unit}</span>}
            </div>
            {trend && trendValue && (
              <div className={`flex items-center gap-0.5 text-xs mt-1 ${getTrendColor()}`}>
                {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{trendValue} YoY</span>
              </div>
            )}
            {!trend && value !== null && <div className="text-xs mt-1 text-muted-foreground">-</div>}
          </div>
          <Sparkline data={sparklineData} color={color} />
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Paginated Fetch ───
async function fetchSocialMetricValues(): Promise<MetricValue[]> {
  const PAGE_SIZE = 2000;
  const allValues: MetricValue[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("metric_value")
      .select("value_id, metric_id, site_id, period_id, value, status")
      .in("metric_id", SOCIAL_METRIC_IDS)
      .in("status", ["submitted", "approved", "draft"])
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      for (const row of data) allValues.push(row);
      from += data.length;
    } else {
      hasMore = false;
    }
  }
  return allValues;
}

// ─── Helpers ───
function sumByMetric(values: MetricValue[], metricId: string): number {
  return values.filter(v => v.metric_id === metricId).reduce((s, v) => s + v.value, 0);
}
function sumByMetrics(values: MetricValue[], ids: string[]): number {
  return values.filter(v => ids.includes(v.metric_id)).reduce((s, v) => s + v.value, 0);
}

// ─── Main Component ───
export default function Social() {
  const { language } = useLanguage();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [metrics, setMetrics] = useState<EsgMetric[]>([]);
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");

  const handleRefresh = useCallback(async () => { await fetchData(); }, []);
  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({ onRefresh: handleRefresh });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: companiesData },
        { data: sitesData },
        { data: periodsData },
        { data: metricsData },
        socialValues,
      ] = await Promise.all([
        supabase.from("company").select("*").order("company_name"),
        supabase.from("site").select("*").order("site_name"),
        supabase.from("reporting_period").select("*").order("year", { ascending: false }),
        supabase.from("esg_metric").select("*").in("metric_id", SOCIAL_METRIC_IDS),
        fetchSocialMetricValues(),
      ]);

      setCompanies(companiesData || []);
      setSites(sitesData || []);
      setPeriods(periodsData || []);
      setMetrics(metricsData || []);
      setMetricValues(socialValues);

      // Auto-select latest year with data
      if (!filterYear && periodsData) {
        const yearsWithData = new Set(socialValues.map(v => {
          const p = (periodsData as ReportingPeriod[]).find(pp => pp.period_id === v.period_id);
          return p?.year;
        }).filter(Boolean));
        const latestYear = Math.max(...Array.from(yearsWithData) as number[]);
        if (latestYear && isFinite(latestYear)) setFilterYear(String(latestYear));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Computed Data ───
  const uniqueYears = useMemo(() => [...new Set(periods.map(p => p.year))].sort((a, b) => b - a), [periods]);
  const isAllTime = !filterYear || filterYear === "__all__";
  const selectedYear = (!isAllTime && filterYear) ? parseInt(filterYear) : uniqueYears[0];
  const prevYear = isAllTime ? null : (selectedYear ? selectedYear - 1 : null);

  const filteredSites = useMemo(() =>
    filterCompany ? sites.filter(s => s.company_id === filterCompany) : sites,
    [sites, filterCompany]
  );

  const filteredValues = useMemo(() => {
    return metricValues.filter(v => {
      if (filterCompany) {
        const site = sites.find(s => s.site_id === v.site_id);
        if (site?.company_id !== filterCompany) return false;
      }
      if (filterSite && v.site_id !== filterSite) return false;
      if (!isAllTime && filterYear) {
        const period = periods.find(p => p.period_id === v.period_id);
        if (period?.year !== parseInt(filterYear)) return false;
      }
      return true;
    });
  }, [metricValues, filterCompany, filterSite, filterYear, sites, periods]);

  // Previous year values for YoY
  const prevYearValues = useMemo(() => {
    if (!prevYear) return [];
    return metricValues.filter(v => {
      if (filterCompany) {
        const site = sites.find(s => s.site_id === v.site_id);
        if (site?.company_id !== filterCompany) return false;
      }
      if (filterSite && v.site_id !== filterSite) return false;
      const period = periods.find(p => p.period_id === v.period_id);
      return period?.year === prevYear;
    });
  }, [metricValues, prevYear, filterCompany, filterSite, sites, periods]);

  const hasData = filteredValues.length > 0;

  // ─── KPI Calculations ───
  const totalTrainingHours = sumByMetric(filteredValues, METRIC.TRAINING_HOURS);
  const totalLTI = sumByMetric(filteredValues, METRIC.LTI);
  const totalWellbeingAccess = sumByMetric(filteredValues, METRIC.WELLBEING_ACCESS);
  const totalHumanRightsViolations = sumByMetric(filteredValues, METRIC.HUMAN_RIGHTS_VIOLATIONS);
  const totalWorkingHours = sumByMetric(filteredValues, METRIC.WORKING_HOURS);
  const totalFoodDonation = sumByMetric(filteredValues, METRIC.FOOD_DONATION);

  // LTIFR = (LTI × 1,000,000) / Working Hours
  const ltifr = totalWorkingHours > 0 ? (totalLTI * 1_000_000) / totalWorkingHours : null;

  // YoY calculations
  const calcYoY = (currentVal: number, metricIds: string[], context: "positive" | "negative" = "positive"): { trend: "up" | "down" | "neutral" | null; value: string | null } => {
    const prev = sumByMetrics(prevYearValues, metricIds);
    if (prev === 0 || currentVal === 0) return { trend: null, value: null };
    const change = ((currentVal - prev) / prev) * 100;
    return {
      trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
      value: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
    };
  };

  const trainingYoY = calcYoY(totalTrainingHours, [METRIC.TRAINING_HOURS]);
  const ltiYoY = calcYoY(totalLTI, [METRIC.LTI]);
  const wellbeingYoY = calcYoY(totalWellbeingAccess, [METRIC.WELLBEING_ACCESS]);
  const humanRightsYoY = calcYoY(totalHumanRightsViolations, [METRIC.HUMAN_RIGHTS_VIOLATIONS]);

  // ─── Helper: get relevant periods for charts ───
  const chartPeriods = useMemo(() => {
    if (isAllTime) {
      const latestYear = uniqueYears[0];
      return periods.filter(p => p.year === latestYear).sort((a, b) => a.month - b.month);
    }
    return periods.filter(p => p.year === selectedYear).sort((a, b) => a.month - b.month);
  }, [periods, selectedYear, isAllTime, uniqueYears]);

  const getMonthValues = useCallback((month: number) => {
    if (isAllTime) {
      const monthPeriodIds = periods.filter(p => p.month === month).map(p => p.period_id);
      return filteredValues.filter(v => monthPeriodIds.includes(v.period_id));
    }
    const periodId = periods.find(p => p.year === selectedYear && p.month === month)?.period_id;
    return periodId ? filteredValues.filter(v => v.period_id === periodId) : [];
  }, [filteredValues, periods, selectedYear, isAllTime]);

  // ─── Monthly Sparkline ───
  const monthlySparkline = useCallback((metricIds: string[]) => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getMonthValues(period.month);
      return pv.filter(v => metricIds.includes(v.metric_id)).reduce((s, v) => s + v.value, 0);
    }).filter(v => v > 0);
  }, [chartPeriods, getMonthValues]);

  // ─── 1. Training Hours Monthly Trend ───
  const trainingChartData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getMonthValues(period.month);
      const hours = pv.filter(v => v.metric_id === METRIC.TRAINING_HOURS).reduce((s, v) => s + v.value, 0);
      return { name: period.month_name.slice(0, 3), hours: hours || null };
    });
  }, [chartPeriods, getMonthValues]);
  const hasTrainingData = trainingChartData.some(d => d.hours !== null);

  // ─── 2. Training Hours by Site ───
  const trainingBySiteData = useMemo(() => {
    return filteredSites
      .map(site => {
        const siteValues = filteredValues.filter(v => v.site_id === site.site_id && v.metric_id === METRIC.TRAINING_HOURS);
        const total = siteValues.reduce((s, v) => s + v.value, 0);
        return {
          name: site.site_name.length > 15 ? site.site_name.substring(0, 15) + "…" : site.site_name,
          fullName: site.site_name,
          hours: Math.round(total),
        };
      })
      .filter(d => d.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [filteredValues, filteredSites]);

  // ─── 3. LTI Monthly Trend ───
  const ltiChartData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getMonthValues(period.month);
      const lti = pv.filter(v => v.metric_id === METRIC.LTI).reduce((s, v) => s + v.value, 0);
      return { name: period.month_name.slice(0, 3), lti: lti };
    });
  }, [chartPeriods, getMonthValues]);
  const hasLtiData = ltiChartData.some(d => d.lti > 0);

  // ─── 4. LTI by Site ───
  const ltiBySiteData = useMemo(() => {
    return filteredSites
      .map(site => {
        const siteValues = filteredValues.filter(v => v.site_id === site.site_id && v.metric_id === METRIC.LTI);
        const total = siteValues.reduce((s, v) => s + v.value, 0);
        return {
          name: site.site_name.length > 15 ? site.site_name.substring(0, 15) + "…" : site.site_name,
          lti: total,
        };
      })
      .filter(d => d.lti > 0)
      .sort((a, b) => b.lti - a.lti);
  }, [filteredValues, filteredSites]);

  // ─── 5. Wellbeing Access Monthly ───
  const wellbeingChartData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getMonthValues(period.month);
      const count = pv.filter(v => v.metric_id === METRIC.WELLBEING_ACCESS).reduce((s, v) => s + v.value, 0);
      return { name: period.month_name.slice(0, 3), participants: count || null };
    });
  }, [chartPeriods, getMonthValues]);
  const hasWellbeingData = wellbeingChartData.some(d => d.participants !== null);

  // ─── 6. Wellbeing by Site (Pie) ───
  const wellbeingBySiteData = useMemo(() => {
    const COLORS = ["hsl(199 89% 48%)", "hsl(142 71% 45%)", "hsl(262 83% 58%)", "hsl(25 95% 53%)", "hsl(45 93% 47%)", "hsl(340 75% 55%)"];
    return filteredSites
      .map((site, i) => {
        const siteValues = filteredValues.filter(v => v.site_id === site.site_id && v.metric_id === METRIC.WELLBEING_ACCESS);
        const total = siteValues.reduce((s, v) => s + v.value, 0);
        return {
          name: site.site_name.length > 12 ? site.site_name.substring(0, 12) + "…" : site.site_name,
          value: total,
          color: COLORS[i % COLORS.length],
        };
      })
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredValues, filteredSites]);

  // ─── 7. Human Rights Violations Monthly ───
  const humanRightsChartData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getMonthValues(period.month);
      const violations = pv.filter(v => v.metric_id === METRIC.HUMAN_RIGHTS_VIOLATIONS).reduce((s, v) => s + v.value, 0);
      return { name: period.month_name.slice(0, 3), violations };
    });
  }, [chartPeriods, getMonthValues]);
  const hasHumanRightsData = humanRightsChartData.length > 0;

  // ─── Health & Safety Composite (LTI + Wellbeing) ───
  const safetyCompositeData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getMonthValues(period.month);
      const lti = pv.filter(v => v.metric_id === METRIC.LTI).reduce((s, v) => s + v.value, 0);
      const wellbeing = pv.filter(v => v.metric_id === METRIC.WELLBEING_ACCESS).reduce((s, v) => s + v.value, 0);
      return { name: period.month_name.slice(0, 3), lti, wellbeing: wellbeing || null };
    });
  }, [chartPeriods, getMonthValues]);
  const hasSafetyCompositeData = safetyCompositeData.some(d => d.lti > 0 || (d.wellbeing !== null && d.wellbeing > 0));

  // ─── Summary Table Data ───
  const summaryTableData = useMemo(() => {
    const metricMap = new Map(metrics.map(m => [m.metric_id, m]));
    const grouped = new Map<string, { current: number; prev: number }>();

    for (const v of filteredValues) {
      const m = metricMap.get(v.metric_id);
      if (!m) continue;
      const existing = grouped.get(v.metric_id) || { current: 0, prev: 0 };
      existing.current += v.value;
      grouped.set(v.metric_id, existing);
    }
    for (const v of prevYearValues) {
      const m = metricMap.get(v.metric_id);
      if (!m) continue;
      const existing = grouped.get(v.metric_id) || { current: 0, prev: 0 };
      existing.prev += v.value;
      grouped.set(v.metric_id, existing);
    }

    return Array.from(grouped.entries())
      .map(([id, data]) => {
        const m = metricMap.get(id)!;
        const change = data.prev > 0 ? ((data.current - data.prev) / data.prev * 100) : null;
        return { id, name: m.metric_name, unit: m.unit || "", current: data.current, prev: data.prev, change };
      })
      .filter(d => d.current > 0 || d.prev > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredValues, prevYearValues, metrics]);

  // ─── Chart Colors ───
  const THEME_COLORS = {
    training: "hsl(262 83% 58%)",
    lti: "hsl(var(--destructive))",
    wellbeing: "hsl(142 71% 45%)",
    humanRights: "hsl(45 93% 47%)",
    accent: "hsl(199 89% 48%)",
  };

  if (loading) return <ReportsLoadingSkeleton />;

  return (
    <div ref={containerRef} className="space-y-6 pb-8 bg-gradient-to-br from-gray-50 via-white to-blue-50/30 min-h-screen -m-6 p-6">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            Social Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th"
              ? "วิเคราะห์ตัวชี้วัดด้านสังคมครบทุกมิติ — ความปลอดภัย, การอบรม, สุขภาวะ, สิทธิมนุษยชน"
              : "Comprehensive social analysis — Safety, Training, Well-being, Human Rights"}
          </p>
          {hasData && (
            <Badge variant="outline" className="mt-2 text-xs bg-blue-50 text-blue-700 border-blue-200">
              {filteredValues.length.toLocaleString()} {language === "th" ? "รายการ" : "records"} | {selectedYear}
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 rounded-2xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "บริษัท" : "Company"}</Label>
              <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v === "__all__" ? "" : v); setFilterSite(""); }}>
                <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-blue-500/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl">
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {companies.map(c => <SelectItem key={c.company_id} value={c.company_id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "สถานที่" : "Site"}</Label>
              <Select value={filterSite} onValueChange={(v) => setFilterSite(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-blue-500/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl">
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {filteredSites.map(s => <SelectItem key={s.site_id} value={s.site_id}>{s.site_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "ปี" : "Year"}</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-blue-500/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl">
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {uniqueYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - 6 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SocialKPICard
          title={language === "th" ? "ชั่วโมงอบรมรวม" : "Total Training Hours"}
          value={hasData && totalTrainingHours > 0 ? totalTrainingHours.toLocaleString() : null}
          unit={language === "th" ? "ชั่วโมง" : "hours"}
          icon={GraduationCap}
          trend={trainingYoY.trend}
          trendValue={trainingYoY.value}
          trendContext="positive"
          sparklineData={monthlySparkline([METRIC.TRAINING_HOURS])}
          color="hsl(262 83% 58%)"
        />
        <SocialKPICard
          title={language === "th" ? "เหตุบาดเจ็บหยุดงาน (LTI)" : "Lost Time Injuries"}
          value={hasData ? totalLTI.toLocaleString() : null}
          unit={language === "th" ? "ครั้ง" : "cases"}
          icon={AlertTriangle}
          trend={ltiYoY.trend}
          trendValue={ltiYoY.value}
          trendContext="negative"
          sparklineData={monthlySparkline([METRIC.LTI])}
          color="hsl(0 84% 60%)"
        />
        <SocialKPICard
          title={language === "th" ? "พนักงานเข้าถึง Well-being" : "Well-being Participants"}
          value={hasData && totalWellbeingAccess > 0 ? totalWellbeingAccess.toLocaleString() : null}
          unit={language === "th" ? "คน" : "people"}
          icon={Smile}
          trend={wellbeingYoY.trend}
          trendValue={wellbeingYoY.value}
          trendContext="positive"
          sparklineData={monthlySparkline([METRIC.WELLBEING_ACCESS])}
          color="hsl(142 71% 45%)"
        />
        <SocialKPICard
          title={language === "th" ? "ละเมิดสิทธิมนุษยชน" : "Human Rights Violations"}
          value={hasData ? totalHumanRightsViolations.toLocaleString() : null}
          unit={language === "th" ? "ครั้ง" : "cases"}
          icon={Scale}
          trend={humanRightsYoY.trend}
          trendValue={humanRightsYoY.value}
          trendContext="negative"
          sparklineData={monthlySparkline([METRIC.HUMAN_RIGHTS_VIOLATIONS])}
          color="hsl(45 93% 47%)"
        />
        <SocialKPICard
          title="LTIFR"
          value={ltifr !== null ? ltifr.toFixed(2) : null}
          unit={language === "th" ? "ต่อล้านชม." : "per M hrs"}
          icon={ShieldCheck}
          trend={null}
          trendValue={null}
          sparklineData={[]}
          color="hsl(25 95% 53%)"
        />
        <SocialKPICard
          title={language === "th" ? "บริจาคอาหาร" : "Food Donation"}
          value={hasData && totalFoodDonation > 0 ? totalFoodDonation.toLocaleString() : null}
          unit="kg"
          icon={PackageOpen}
          trend={null}
          trendValue={null}
          trendContext="positive"
          sparklineData={monthlySparkline([METRIC.FOOD_DONATION])}
          color="hsl(199 89% 48%)"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Training Hours Monthly - Full Width */}
        <Card className="lg:col-span-2 bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl"><GraduationCap className="h-4 w-4 text-purple-600" /></div>
            <div>
              <CardTitle className="text-base font-medium">
                {language === "th" ? "ชั่วโมงอบรมรวมรายเดือน" : "Monthly Training Hours"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{language === "th" ? "หน่วย: ชั่วโมง" : "Unit: Hours"}</p>
            </div>
          </CardHeader>
          <CardContent>
            {hasTrainingData ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={trainingChartData.filter(d => d.hours !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number) => [`${value.toLocaleString()} ${language === "th" ? "ชั่วโมง" : "hrs"}`, ""]} />
                  <Legend />
                  <Bar dataKey="hours" name={language === "th" ? "ชั่วโมงอบรม" : "Training Hours"} fill={THEME_COLORS.training} fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="hours" name={language === "th" ? "แนวโน้ม" : "Trend"} stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูลการอบรม" : "No training data"} />
            )}
          </CardContent>
        </Card>

        {/* 2. Training Hours by Site */}
        <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl"><GraduationCap className="h-4 w-4 text-purple-600" /></div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "ชั่วโมงอบรมแยกตามสถานที่" : "Training Hours by Site"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trainingBySiteData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trainingBySiteData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number) => [`${value.toLocaleString()} ${language === "th" ? "ชั่วโมง" : "hrs"}`, ""]} />
                  <Bar dataKey="hours" name={language === "th" ? "ชั่วโมงอบรม" : "Training Hours"} fill={THEME_COLORS.training} fillOpacity={0.8} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data"} />
            )}
          </CardContent>
        </Card>

        {/* 3. Well-being by Site (Pie) */}
        <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl"><Smile className="h-4 w-4 text-green-600" /></div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "สัดส่วนพนักงานเข้าถึง Well-being แยกสถานที่" : "Well-being Access by Site"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wellbeingBySiteData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={wellbeingBySiteData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {wellbeingBySiteData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => [`${value.toLocaleString()} ${language === "th" ? "คน" : "people"}`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {wellbeingBySiteData.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล Well-being" : "No well-being data"} />
            )}
          </CardContent>
        </Card>

        {/* 4. Health & Safety Composite (LTI + Wellbeing Monthly) - Full Width */}
        <Card className="lg:col-span-2 bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl"><ShieldCheck className="h-4 w-4 text-red-600" /></div>
            <div>
              <CardTitle className="text-base font-medium">
                {language === "th" ? "Health & Safety รายเดือน (LTI vs Well-being)" : "Monthly Health & Safety (LTI vs Well-being)"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {language === "th" ? "เปรียบเทียบจำนวนเหตุบาดเจ็บกับการเข้าถึงโครงการสุขภาวะ" : "Comparing injuries vs well-being program access"}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {hasSafetyCompositeData ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={safetyCompositeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={glassTooltipStyle} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="lti" name={language === "th" ? "LTI (ครั้ง)" : "LTI (cases)"} fill={THEME_COLORS.lti} fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="wellbeing" name={language === "th" ? "Well-being (คน)" : "Well-being (people)"} stroke={THEME_COLORS.wellbeing} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูลความปลอดภัย" : "No safety data"} />
            )}
          </CardContent>
        </Card>

        {/* 5. LTI by Site */}
        <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl"><AlertTriangle className="h-4 w-4 text-red-600" /></div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "เหตุบาดเจ็บ LTI แยกตามสถานที่" : "LTI by Site"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ltiBySiteData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ltiBySiteData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number) => [`${value} ${language === "th" ? "ครั้ง" : "cases"}`, ""]} />
                  <Bar dataKey="lti" name="LTI" fill={THEME_COLORS.lti} fillOpacity={0.8} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ไม่มีเหตุบาดเจ็บในช่วงนี้ 🎉" : "No injuries in this period 🎉"} />
            )}
          </CardContent>
        </Card>

        {/* 6. Well-being Monthly Trend */}
        <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl"><Smile className="h-4 w-4 text-green-600" /></div>
            <div>
              <CardTitle className="text-base font-medium">
                {language === "th" ? "พนักงานเข้าถึง Well-being รายเดือน" : "Monthly Well-being Access"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{language === "th" ? "หน่วย: คน" : "Unit: People"}</p>
            </div>
          </CardHeader>
          <CardContent>
            {hasWellbeingData ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={wellbeingChartData.filter(d => d.participants !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number) => [`${value.toLocaleString()} ${language === "th" ? "คน" : "people"}`, ""]} />
                  <Area type="monotone" dataKey="participants" name={language === "th" ? "ผู้เข้าร่วม" : "Participants"} stroke={THEME_COLORS.wellbeing} fill={THEME_COLORS.wellbeing} fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล Well-being" : "No well-being data"} />
            )}
          </CardContent>
        </Card>

        {/* 7. Human Rights Violations Monthly */}
        <Card className="lg:col-span-2 bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-xl"><Scale className="h-4 w-4 text-yellow-600" /></div>
            <div>
              <CardTitle className="text-base font-medium">
                {language === "th" ? "เหตุการณ์ละเมิดสิทธิมนุษยชน & แรงงานรายเดือน" : "Monthly Human Rights & Labor Violations"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {language === "th" ? "เป้าหมาย: 0 ครั้ง ตลอดทั้งปี" : "Target: 0 incidents throughout the year"}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {hasHumanRightsData ? (
              <div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={humanRightsChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number) => [`${value} ${language === "th" ? "ครั้ง" : "cases"}`, ""]} />
                    <Bar dataKey="violations" name={language === "th" ? "เหตุการณ์ละเมิด" : "Violations"} fill={THEME_COLORS.humanRights} fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {totalHumanRightsViolations === 0 && (
                  <div className="text-center mt-3">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-sm px-4 py-1">
                      ✅ {language === "th" ? "ไม่มีเหตุการณ์ละเมิดสิทธิมนุษยชนตลอดทั้งปี" : "Zero human rights violations throughout the year"}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data"} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl"><BarChart3 className="h-4 w-4 text-blue-600" /></div>
          <div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "สรุปตัวชี้วัดด้านสังคม" : "Social Metrics Summary"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {selectedYear} vs {prevYear || "-"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {summaryTableData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "th" ? "ตัวชี้วัด" : "Metric"}</TableHead>
                    <TableHead>{language === "th" ? "หน่วย" : "Unit"}</TableHead>
                    <TableHead className="text-right">{selectedYear}</TableHead>
                    <TableHead className="text-right">{prevYear || "-"}</TableHead>
                    <TableHead className="text-right">{language === "th" ? "เปลี่ยนแปลง" : "Change"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryTableData.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm max-w-[300px]">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{row.unit}</TableCell>
                      <TableCell className="text-right font-semibold">{row.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.prev > 0 ? row.prev.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}</TableCell>
                      <TableCell className="text-right">
                        {row.change !== null ? (
                          <span className={row.change > 0 ? "text-destructive" : row.change < 0 ? "text-emerald-600" : "text-muted-foreground"}>
                            {row.change > 0 ? "+" : ""}{row.change.toFixed(1)}%
                          </span>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูลสรุป" : "No summary data"} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
