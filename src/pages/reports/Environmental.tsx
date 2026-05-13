import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Leaf,
  Zap,
  Droplets,
  Trash2,
  Factory,
  BarChart3,
  Fuel,
  Recycle,
  Wind,
  Clock,
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
  ReferenceLine,
} from "recharts";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh";
import { ReportsLoadingSkeleton } from "@/components/ui/loading-skeleton";
import { TrendAnalytics } from "@/components/reports/TrendAnalytics";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { ChartScrollWrapper } from "@/components/reports/ChartScrollWrapper";
import { FullscreenButton, useFullscreen } from "@/components/reports/FullscreenButton";
import { TVNavBar } from "@/components/reports/TVNavBar";

// ─── Metric ID Constants ───
const METRIC = {
  GRID_ELECTRICITY: "MET001",
  RENEWABLE_ENERGY: "MET002",
  GHG_SCOPE1: "MET003",
  GHG_SCOPE2: "MET004",
  WATER_WITHDRAWAL: "MET005",
  WATER_RECYCLING: "MET006",
  LPG: "MET007",
  TOTAL_WASTE: "MET018",
  WASTE_RECYCLED: "MET021",
  WATER_DISCHARGE: "MET034",
  DIESEL_FLEET: "MET029",
  DIESEL_FORKLIFT: "MET030",
  GASOHOL_91: "MET032",
  GASOHOL_95: "MET031",
  GASOHOL_E20: "MET033",
  DIESEL_FIREPUMP: "MET027",
  DIESEL_GENERATOR: "MET028",
};

const ENV_METRIC_IDS = Object.values(METRIC);

// ─── Interfaces ───
interface Company { company_id: string; company_name: string; }
interface Site { site_id: string; site_name: string; company_id: string; }
interface ReportingPeriod { period_id: string; year: number; month: number; month_name: string; }
interface EsgMetric { metric_id: string; metric_name: string; theme_id: string; unit: string | null; }
interface MetricValue {
  value_id: string; metric_id: string; site_id: string; period_id: string;
  value: number; status: string; last_updated: string | null;
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
const EnvKPICard = ({
  title, value, unit, icon: Icon, trend, trendValue, sparklineData, color,
}: {
  title: string; value: string | number | null; unit: string; icon: React.ElementType;
  trend?: "up" | "down" | "neutral" | null; trendValue?: string | null;
  sparklineData: number[]; color: string;
}) => {
  const isPositiveTrend = trend === "down";
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
              <div className={`flex items-center gap-0.5 text-xs mt-1 ${isPositiveTrend ? "text-emerald-600" : trend === "up" ? "text-destructive" : "text-muted-foreground"}`}>
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
async function fetchEnvMetricValues(): Promise<MetricValue[]> {
  const PAGE_SIZE = 2000;
  const allValues: MetricValue[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("metric_value")
      .select("value_id, metric_id, site_id, period_id, value, status, last_updated")
      .in("metric_id", ENV_METRIC_IDS)
      .in("status", ["submitted", "approved", "draft"])
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      for (const row of data) allValues.push(row);
      from += data.length;
      hasMore = true;
    } else {
      hasMore = false;
    }
  }
  return allValues;
}

// ─── Helper ───
function sumByMetric(values: MetricValue[], metricId: string): number {
  return values.filter(v => v.metric_id === metricId).reduce((s, v) => s + v.value, 0);
}
function sumByMetrics(values: MetricValue[], ids: string[]): number {
  return values.filter(v => ids.includes(v.metric_id)).reduce((s, v) => s + v.value, 0);
}

// ─── Main Component ───
export default function Environmental() {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(fullscreenRef);
  const { language } = useLanguage();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [metrics, setMetrics] = useState<EsgMetric[]>([]);
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("__all__");

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
        envValues,
      ] = await Promise.all([
        supabase.from("company").select("*").order("company_name"),
        supabase.from("site").select("*").order("site_name"),
        supabase.from("reporting_period").select("*").order("year", { ascending: false }),
        supabase.from("esg_metric").select("*").in("metric_id", ENV_METRIC_IDS),
        fetchEnvMetricValues(),
      ]);

      setCompanies(companiesData || []);
      setSites(sitesData || []);
      setPeriods(periodsData || []);
      setMetrics(metricsData || []);
      setMetricValues(envValues);

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

  // ─── Last Updated ───
  const lastUpdated = useMemo(() => {
    const timestamps = filteredValues
      .map(v => v.last_updated)
      .filter((t): t is string => !!t)
      .map(t => new Date(t).getTime());
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  }, [filteredValues]);

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleString(language === "th" ? "th-TH" : "en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  // ─── KPI Calculations ───
  const ghgScope1 = sumByMetric(filteredValues, METRIC.GHG_SCOPE1);
  const ghgScope2 = sumByMetric(filteredValues, METRIC.GHG_SCOPE2);
  const totalGHG = ghgScope1 + ghgScope2;

  const gridElectricity = sumByMetric(filteredValues, METRIC.GRID_ELECTRICITY);
  const renewableEnergy = sumByMetric(filteredValues, METRIC.RENEWABLE_ENERGY);
  const totalElectricity = gridElectricity + renewableEnergy;
  const renewablePercent = totalElectricity > 0 ? ((renewableEnergy / totalElectricity) * 100) : 0;

  const waterWithdrawal = sumByMetric(filteredValues, METRIC.WATER_WITHDRAWAL);
  const waterRecycling = sumByMetric(filteredValues, METRIC.WATER_RECYCLING);
  const waterDischarge = sumByMetric(filteredValues, METRIC.WATER_DISCHARGE);

  const totalWaste = sumByMetric(filteredValues, METRIC.TOTAL_WASTE);
  const wasteRecycled = sumByMetric(filteredValues, METRIC.WASTE_RECYCLED);
  const wasteDiversionRate = totalWaste > 0 ? ((wasteRecycled / totalWaste) * 100) : 0;

  // YoY calculations
  const calcYoY = (currentVal: number, metricIds: string[]): { trend: "up" | "down" | "neutral" | null; value: string | null } => {
    const prev = sumByMetrics(prevYearValues, metricIds);
    if (prev === 0 || currentVal === 0) return { trend: null, value: null };
    const change = ((currentVal - prev) / prev) * 100;
    return {
      trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
      value: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
    };
  };

  const ghgYoY = calcYoY(totalGHG, [METRIC.GHG_SCOPE1, METRIC.GHG_SCOPE2]);
  const electricityYoY = calcYoY(totalElectricity, [METRIC.GRID_ELECTRICITY, METRIC.RENEWABLE_ENERGY]);
  const waterYoY = calcYoY(waterWithdrawal, [METRIC.WATER_WITHDRAWAL]);
  const wasteYoY = calcYoY(totalWaste, [METRIC.TOTAL_WASTE]);

  // ─── Helper: get relevant periods for charts ───
  const chartPeriods = useMemo(() => {
    if (isAllTime) {
      // Show ALL periods that have data across all years, sorted by year then month
      const periodsWithData = new Set(filteredValues.map(v => v.period_id));
      const allRelevant = periods.filter(p => periodsWithData.has(p.period_id));
      if (allRelevant.length === 0) {
        const latestYear = uniqueYears[0];
        return periods.filter(p => p.year === latestYear).sort((a, b) => a.month - b.month);
      }
      return allRelevant.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    }
    return periods.filter(p => p.year === selectedYear).sort((a, b) => a.month - b.month);
  }, [periods, selectedYear, isAllTime, uniqueYears, filteredValues]);

  // ─── Helper: get values for a specific period_id ───
  const getPeriodValues = useCallback((periodId: string) => {
    return filteredValues.filter(v => v.period_id === periodId);
  }, [filteredValues]);

  // When All Time, get filteredValues for a specific month (across all years)
  const getMonthValues = useCallback((month: number) => {
    if (isAllTime) {
      const monthPeriodIds = periods.filter(p => p.month === month).map(p => p.period_id);
      return filteredValues.filter(v => monthPeriodIds.includes(v.period_id));
    }
    const periodId = periods.find(p => p.year === selectedYear && p.month === month)?.period_id;
    return periodId ? filteredValues.filter(v => v.period_id === periodId) : [];
  }, [filteredValues, periods, selectedYear, isAllTime]);

  // ─── Monthly Sparkline ───
  // ─── Monthly chart label helper ───
  const periodLabel = useCallback((period: { month_name: string; year: number }) => {
    return isAllTime
      ? `${period.month_name.slice(0, 3)} '${String(period.year).slice(2)}`
      : period.month_name.slice(0, 3);
  }, [isAllTime]);

  const monthlySparkline = useCallback((metricIds: string[]) => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getPeriodValues(period.period_id);
      return pv.filter(v => metricIds.includes(v.metric_id)).reduce((s, v) => s + v.value, 0);
    }).filter(v => v > 0);
  }, [chartPeriods, getPeriodValues]);

  // ─── GHG Monthly Chart Data ───
  const ghgChartData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getPeriodValues(period.period_id);
      const scope1 = pv.filter(v => v.metric_id === METRIC.GHG_SCOPE1).reduce((s, v) => s + v.value, 0);
      const scope2 = pv.filter(v => v.metric_id === METRIC.GHG_SCOPE2).reduce((s, v) => s + v.value, 0);
      return {
        name: periodLabel(period),
        scope1: scope1 || null,
        scope2: scope2 || null,
        total: (scope1 + scope2) || null,
      };
    });
  }, [chartPeriods, getPeriodValues, periodLabel]);
  const hasGhgData = ghgChartData.some(d => d.total !== null);

  // ─── Energy Mix Pie ───
  const energyMixData = useMemo(() => {
    if (totalElectricity === 0) return [];
    const lpg = sumByMetric(filteredValues, METRIC.LPG);
    const diesel = sumByMetrics(filteredValues, [METRIC.DIESEL_FLEET, METRIC.DIESEL_FORKLIFT, METRIC.DIESEL_FIREPUMP, METRIC.DIESEL_GENERATOR]);
    const gasohol = sumByMetrics(filteredValues, [METRIC.GASOHOL_91, METRIC.GASOHOL_95, METRIC.GASOHOL_E20]);
    const items: { name: string; value: number; color: string; unit: string }[] = [];
    if (gridElectricity > 0) items.push({
      name: language === "th" ? "ไฟฟ้าโครงข่าย" : "Grid Electricity",
      value: gridElectricity, color: "hsl(45 93% 47%)", unit: "kWh",
    });
    if (renewableEnergy > 0) items.push({
      name: language === "th" ? "พลังงานหมุนเวียน" : "Renewable Energy",
      value: renewableEnergy, color: "hsl(142 71% 45%)", unit: "kWh",
    });
    if (lpg > 0) items.push({
      name: "LPG", value: lpg, color: "hsl(25 95% 53%)", unit: "kg",
    });
    if (diesel > 0) items.push({
      name: language === "th" ? "ดีเซล" : "Diesel",
      value: diesel, color: "hsl(var(--muted-foreground))", unit: "L",
    });
    if (gasohol > 0) items.push({
      name: language === "th" ? "แก๊สโซฮอล์" : "Gasohol",
      value: gasohol, color: "hsl(280 65% 60%)", unit: "L",
    });
    return items;
  }, [filteredValues, totalElectricity, gridElectricity, renewableEnergy, language]);

  // ─── Electricity Monthly (Grid vs Renewable) ───
  const electricityChartData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getPeriodValues(period.period_id);
      const grid = pv.filter(v => v.metric_id === METRIC.GRID_ELECTRICITY).reduce((s, v) => s + v.value, 0);
      const renew = pv.filter(v => v.metric_id === METRIC.RENEWABLE_ENERGY).reduce((s, v) => s + v.value, 0);
      return {
        name: periodLabel(period),
        grid: grid || null,
        renewable: renew || null,
      };
    });
  }, [chartPeriods, getPeriodValues, periodLabel]);
  const hasElectricityData = electricityChartData.some(d => d.grid !== null || d.renewable !== null);

  // ─── Water by Site ───
  const waterBySiteData = useMemo(() => {
    const waterMetrics = [METRIC.WATER_WITHDRAWAL];
    return filteredSites
      .map(site => {
        const siteValues = filteredValues.filter(v => v.site_id === site.site_id && waterMetrics.includes(v.metric_id));
        const total = siteValues.reduce((s, v) => s + v.value, 0);
        return {
          name: site.site_name.length > 15 ? site.site_name.substring(0, 15) + "…" : site.site_name,
          withdrawal: Math.round(total),
        };
      })
      .filter(d => d.withdrawal > 0)
      .sort((a, b) => b.withdrawal - a.withdrawal);
  }, [filteredValues, filteredSites]);

  // ─── Water Balance (Withdrawal / Discharge / Recycling) ───
  const waterBalanceData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getPeriodValues(period.period_id);
      const wd = pv.filter(v => v.metric_id === METRIC.WATER_WITHDRAWAL).reduce((s, v) => s + v.value, 0);
      const wdis = pv.filter(v => v.metric_id === METRIC.WATER_DISCHARGE).reduce((s, v) => s + v.value, 0);
      const wr = pv.filter(v => v.metric_id === METRIC.WATER_RECYCLING).reduce((s, v) => s + v.value, 0);
      return { name: periodLabel(period), withdrawal: wd || null, discharge: wdis || null, recycling: wr || null };
    });
  }, [chartPeriods, getPeriodValues, periodLabel]);
  const hasWaterBalanceData = waterBalanceData.some(d => d.withdrawal !== null);

  // ─── Waste Pie (Recycled vs Landfill) ───
  const wastePieData = useMemo(() => {
    if (totalWaste === 0) return [];
    const landfill = totalWaste - wasteRecycled;
    return [
      { name: language === "th" ? "นำกลับมาใช้ (Recycle/Reuse)" : "Recycled/Reused", value: wasteRecycled, color: "hsl(142 71% 45%)" },
      { name: language === "th" ? "ฝังกลบ (Landfill)" : "Landfill", value: Math.max(0, landfill), color: "hsl(var(--muted-foreground))" },
    ].filter(d => d.value > 0);
  }, [totalWaste, wasteRecycled, language]);

  // ─── Waste Monthly Trend ───
  const wasteChartData = useMemo(() => {
    if (chartPeriods.length === 0) return [];
    return chartPeriods.map(period => {
      const pv = getPeriodValues(period.period_id);
      const total = pv.filter(v => v.metric_id === METRIC.TOTAL_WASTE).reduce((s, v) => s + v.value, 0);
      const recycled = pv.filter(v => v.metric_id === METRIC.WASTE_RECYCLED).reduce((s, v) => s + v.value, 0);
      return { name: periodLabel(period), total: total || null, recycled: recycled || null };
    });
  }, [chartPeriods, getPeriodValues, periodLabel]);
  const hasWasteChartData = wasteChartData.some(d => d.total !== null);

  // ─── GHG by Site ───
  const ghgBySiteData = useMemo(() => {
    return filteredSites
      .map(site => {
        const sv = filteredValues.filter(v => v.site_id === site.site_id);
        const s1 = sv.filter(v => v.metric_id === METRIC.GHG_SCOPE1).reduce((s, v) => s + v.value, 0);
        const s2 = sv.filter(v => v.metric_id === METRIC.GHG_SCOPE2).reduce((s, v) => s + v.value, 0);
        return {
          name: site.site_name.length > 15 ? site.site_name.substring(0, 15) + "…" : site.site_name,
          scope1: parseFloat(s1.toFixed(2)),
          scope2: parseFloat(s2.toFixed(2)),
        };
      })
      .filter(d => d.scope1 > 0 || d.scope2 > 0)
      .sort((a, b) => (b.scope1 + b.scope2) - (a.scope1 + a.scope2));
  }, [filteredValues, filteredSites]);

  // ─── Years with data (for multi-year table) ───
  const yearsWithData = useMemo(() => {
    const yearSet = new Set<number>();
    metricValues.forEach(v => {
      const p = periods.find(pp => pp.period_id === v.period_id);
      if (p) yearSet.add(p.year);
    });
    return [...yearSet].sort((a, b) => b - a);
  }, [metricValues, periods]);

  // ─── Summary Table Data ───
  const summaryTableData = useMemo(() => {
    const metricMap = new Map(metrics.map(m => [m.metric_id, m]));

    if (isAllTime) {
      // Multi-year: compute per-year values for each metric
      const grouped = new Map<string, Record<number, number>>();
      for (const v of filteredValues) {
        if (!metricMap.has(v.metric_id)) continue;
        const period = periods.find(p => p.period_id === v.period_id);
        if (!period) continue;
        const existing = grouped.get(v.metric_id) || {};
        existing[period.year] = (existing[period.year] || 0) + v.value;
        grouped.set(v.metric_id, existing);
      }
      return Array.from(grouped.entries())
        .map(([id, yearData]) => {
          const m = metricMap.get(id)!;
          const latestTwo = yearsWithData.slice(0, 2);
          const curr = yearData[latestTwo[0]] || 0;
          const prev = latestTwo.length > 1 ? (yearData[latestTwo[1]] || 0) : 0;
          const change = prev > 0 ? ((curr - prev) / prev * 100) : null;
          return { id, name: m.metric_name, unit: m.unit || "", yearData, change };
        })
        .filter(d => Object.values(d.yearData).some(v => v > 0))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Single year mode
    const grouped = new Map<string, { current: number; prev: number }>();
    for (const v of filteredValues) {
      if (!metricMap.has(v.metric_id)) continue;
      const existing = grouped.get(v.metric_id) || { current: 0, prev: 0 };
      existing.current += v.value;
      grouped.set(v.metric_id, existing);
    }
    for (const v of prevYearValues) {
      if (!metricMap.has(v.metric_id)) continue;
      const existing = grouped.get(v.metric_id) || { current: 0, prev: 0 };
      existing.prev += v.value;
      grouped.set(v.metric_id, existing);
    }
    return Array.from(grouped.entries())
      .map(([id, data]) => {
        const m = metricMap.get(id)!;
        const change = data.prev > 0 ? ((data.current - data.prev) / data.prev * 100) : null;
        return { id, name: m.metric_name, unit: m.unit || "", yearData: { [selectedYear]: data.current, ...(prevYear ? { [prevYear]: data.prev } : {}) }, change };
      })
      .filter(d => Object.values(d.yearData).some(v => v > 0))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredValues, prevYearValues, metrics, isAllTime, periods, yearsWithData, selectedYear, prevYear]);

  // Display years for table columns
  const tableYears = useMemo(() => isAllTime ? yearsWithData : (prevYear ? [selectedYear, prevYear] : [selectedYear]), [isAllTime, yearsWithData, selectedYear, prevYear]);

  // ─── Chart Colors ───
  const SCOPE_COLORS = {
    scope1: "hsl(var(--destructive))",
    scope2: "hsl(45 93% 47%)",
  };

  if (loading) return <ReportsLoadingSkeleton />;

  return (
    <div
      ref={fullscreenRef}
      className={isFullscreen
        ? "h-screen overflow-hidden bg-background flex flex-col p-3 gap-2"
        : "space-y-6 pb-8 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 min-h-screen -m-6 p-6"
      }
    >
      {!isFullscreen && <div ref={containerRef} />}
      {!isFullscreen && <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />}
      {!isFullscreen && <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 rounded-full" />}

      {/* Header */}
      <div className={`flex flex-row justify-between items-center gap-2 shrink-0 ${isFullscreen ? "" : "flex-col md:flex-row items-start md:items-center gap-4"}`}>
        <div>
          <h1 className={`font-bold text-foreground flex items-center gap-2 ${isFullscreen ? "text-base" : "text-xl sm:text-2xl"}`}>
            <div className="p-1.5 bg-emerald-100 rounded-xl">
              <Leaf className="h-4 w-4 text-emerald-600" />
            </div>
            {language === "th" ? "สิ่งแวดล้อม" : "Environmental"}
            {isFullscreen && hasData && (
              <Badge variant="outline" className="ml-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                {isAllTime ? (language === "th" ? "ทุกปี" : "All Time") : selectedYear}
              </Badge>
            )}
          </h1>
          {!isFullscreen && (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                {language === "th" ? "วิเคราะห์ตัวชี้วัดด้านสิ่งแวดล้อมครบทุกมิติ — พลังงาน, GHG, น้ำ, ของเสีย" : "Comprehensive environmental analysis — Energy, GHG, Water, Waste"}
              </p>
              {hasData && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    {filteredValues.length.toLocaleString()} {language === "th" ? "รายการ" : "records"} | {isAllTime ? (language === "th" ? "ทุกปี" : "All Time") : selectedYear}
                  </Badge>
                  {formatLastUpdated(lastUpdated) && (
                    <Badge variant="outline" className="text-xs bg-muted/60 text-muted-foreground border-border/50 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {language === "th" ? "อัปเดตล่าสุด" : "Last updated"}: {formatLastUpdated(lastUpdated)}
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isFullscreen && <TVNavBar language={language} />}
          <FullscreenButton language={language} isFullscreen={isFullscreen} toggle={toggleFullscreen} />
          {!isFullscreen && (
            <ExportExcelButton
              data={summaryTableData.map(row => {
                const exportRow: Record<string, unknown> = {
                  [language === "th" ? "ตัวชี้วัด" : "Metric"]: row.name,
                  [language === "th" ? "หน่วย" : "Unit"]: row.unit,
                };
                tableYears.forEach(y => { exportRow[language === "th" ? `ค่าปี ${y}` : `Value ${y}`] = row.yearData[y] || "-"; });
                if (tableYears.length >= 2) {
                  exportRow[language === "th" ? "เปลี่ยนแปลง (%)" : "Change (%)"] = row.change !== null ? `${row.change >= 0 ? "+" : ""}${row.change.toFixed(1)}%` : "-";
                }
                return exportRow;
              })}
              filenamePrefix="environmental_report"
              sourcePage="Environmental Dashboard"
              appliedFilters={{
                company: filterCompany ? companies.find(c => c.company_id === filterCompany)?.company_name || filterCompany : "All",
                site: filterSite ? sites.find(s => s.site_id === filterSite)?.site_name || filterSite : "All",
                year: isAllTime ? "All Time" : String(selectedYear),
              }}
            />
          )}
        </div>
      </div>

      {/* Filters - hidden in TV mode */}
      {!isFullscreen && (
        <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 rounded-2xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{language === "th" ? "บริษัท" : "Company"}</Label>
                <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v === "__all__" ? "" : v); setFilterSite(""); }}>
                  <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-emerald-500/30">
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
                  <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-emerald-500/30">
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
                  <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-emerald-500/30">
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
      )}

      {/* KPI Cards - compact in TV mode */}
      <div className={`grid gap-2 shrink-0 ${isFullscreen ? "grid-cols-6" : "grid-cols-2 lg:grid-cols-3 gap-4"}`}>
        <EnvKPICard
          title={language === "th" ? "GHG รวม (Scope 1+2)" : "Total GHG (Scope 1+2)"}
          value={hasData && totalGHG > 0 ? totalGHG.toLocaleString(undefined, { maximumFractionDigits: 2 }) : null}
          unit="tCO₂e"
          icon={Factory}
          trend={ghgYoY.trend}
          trendValue={ghgYoY.value}
          sparklineData={monthlySparkline([METRIC.GHG_SCOPE1, METRIC.GHG_SCOPE2])}
          color="hsl(0 84% 60%)"
        />
        <EnvKPICard
          title={language === "th" ? "ไฟฟ้ารวม" : "Total Electricity"}
          value={hasData && totalElectricity > 0 ? totalElectricity.toLocaleString() : null}
          unit="kWh"
          icon={Zap}
          trend={electricityYoY.trend}
          trendValue={electricityYoY.value}
          sparklineData={monthlySparkline([METRIC.GRID_ELECTRICITY, METRIC.RENEWABLE_ENERGY])}
          color="hsl(45 93% 47%)"
        />
        <EnvKPICard
          title={language === "th" ? "สัดส่วน Renewable" : "Renewable %"}
          value={hasData && totalElectricity > 0 ? renewablePercent.toFixed(1) : null}
          unit="%"
          icon={Wind}
          trend={null}
          trendValue={null}
          sparklineData={[]}
          color="hsl(142 71% 45%)"
        />
        <EnvKPICard
          title={language === "th" ? "น้ำที่ใช้ทั้งหมด" : "Water Withdrawal"}
          value={hasData && waterWithdrawal > 0 ? waterWithdrawal.toLocaleString() : null}
          unit="m³"
          icon={Droplets}
          trend={waterYoY.trend}
          trendValue={waterYoY.value}
          sparklineData={monthlySparkline([METRIC.WATER_WITHDRAWAL])}
          color="hsl(199 89% 48%)"
        />
        <EnvKPICard
          title={language === "th" ? "ขยะทั้งหมด" : "Total Waste"}
          value={hasData && totalWaste > 0 ? (totalWaste / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) : null}
          unit={language === "th" ? "ตัน" : "tons"}
          icon={Trash2}
          trend={wasteYoY.trend}
          trendValue={wasteYoY.value}
          sparklineData={monthlySparkline([METRIC.TOTAL_WASTE])}
          color="hsl(25 95% 53%)"
        />
        <EnvKPICard
          title={language === "th" ? "อัตราการ Recycle" : "Waste Diversion Rate"}
          value={hasData && totalWaste > 0 ? wasteDiversionRate.toFixed(1) : null}
          unit="%"
          icon={Recycle}
          trend={null}
          trendValue={null}
          sparklineData={[]}
          color="hsl(142 71% 45%)"
        />
      </div>

      {/* Charts */}
      <div className={isFullscreen ? "flex-1 overflow-hidden grid grid-cols-2 grid-rows-2 gap-2 min-h-0" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>

        {/* 1. GHG Emissions Monthly */}
        <Card className={`bg-card/80 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl ${isFullscreen ? "flex flex-col min-h-0 overflow-hidden" : "lg:col-span-2 rounded-3xl"}`}>
          <CardHeader className={`flex flex-row items-center gap-2 ${isFullscreen ? "py-2 px-3 shrink-0" : "gap-3"}`}>
            <div className="p-1.5 bg-emerald-100 rounded-lg"><Factory className="h-3.5 w-3.5 text-emerald-600" /></div>
            <CardTitle className={isFullscreen ? "text-xs font-medium" : "text-base font-medium"}>
              {language === "th" ? "GHG รายเดือน (Scope 1+2)" : "Monthly GHG (Scope 1+2)"}
            </CardTitle>
          </CardHeader>
          <CardContent className={isFullscreen ? "flex-1 min-h-0 p-2" : "p-6 pt-0"}>
            {hasGhgData ? (
              isFullscreen ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ghgChartData.filter(d => d.total !== null)} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                    <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => [`${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`, name === "scope1" ? "Scope 1" : name === "scope2" ? "Scope 2" : "Total"]} labelFormatter={(label) => `📅 ${label}`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="scope1" name="Scope 1" stackId="ghg" fill={SCOPE_COLORS.scope1} fillOpacity={0.8} />
                    <Bar dataKey="scope2" name="Scope 2" stackId="ghg" fill={SCOPE_COLORS.scope2} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--foreground))" strokeWidth={1.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ChartScrollWrapper dataLength={ghgChartData.length} minBarWidth={52} height={300}>
                  <ComposedChart data={ghgChartData.filter(d => d.total !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => [`${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`, name === "scope1" ? "Scope 1" : name === "scope2" ? "Scope 2" : "Total"]} labelFormatter={(label) => `📅 ${label}`} />
                    <Legend />
                    <Bar dataKey="scope1" name="Scope 1" stackId="ghg" fill={SCOPE_COLORS.scope1} fillOpacity={0.8} />
                    <Bar dataKey="scope2" name="Scope 2" stackId="ghg" fill={SCOPE_COLORS.scope2} fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ChartScrollWrapper>
              )
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล GHG" : "No GHG data"} />
            )}
          </CardContent>
        </Card>

        {/* 2. GHG by Site */}
        <Card className={`bg-card/80 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl ${isFullscreen ? "flex flex-col min-h-0 overflow-hidden" : "rounded-3xl"}`}>
          <CardHeader className={`flex flex-row items-center gap-2 ${isFullscreen ? "py-2 px-3 shrink-0" : "gap-3"}`}>
            <div className="p-1.5 bg-emerald-100 rounded-lg"><Factory className="h-3.5 w-3.5 text-emerald-600" /></div>
            <CardTitle className={isFullscreen ? "text-xs font-medium" : "text-base font-medium"}>
              {language === "th" ? "GHG แยกตามสถานที่" : "GHG by Site"}
            </CardTitle>
          </CardHeader>
          <CardContent className={isFullscreen ? "flex-1 min-h-0 p-2" : "p-6 pt-0"}>
            {ghgBySiteData.length > 0 ? (
              <ResponsiveContainer width="100%" height={isFullscreen ? "100%" : Math.max(300, ghgBySiteData.length * 36 + 60)}>
                <BarChart data={ghgBySiteData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: isFullscreen ? 9 : 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: isFullscreen ? 10 : 11 }}
                    width={130}
                    interval={0}
                    tickFormatter={(v: string) => (v && v.length > 18 ? v.slice(0, 17) + "…" : v)}
                  />
                  <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number) => [`${value.toLocaleString()} tCO₂e`, ""]} />
                  <Legend wrapperStyle={{ fontSize: isFullscreen ? 10 : 12 }} />
                  <Bar dataKey="scope1" name="Scope 1" stackId="ghg" fill={SCOPE_COLORS.scope1} fillOpacity={0.8} />
                  <Bar dataKey="scope2" name="Scope 2" stackId="ghg" fill={SCOPE_COLORS.scope2} fillOpacity={0.8} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
            )}
          </CardContent>
        </Card>

        {/* 3. Energy Mix Pie */}
        <Card className={`bg-card/80 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl ${isFullscreen ? "flex flex-col min-h-0 overflow-hidden" : "rounded-3xl"}`}>
          <CardHeader className={`flex flex-row items-center gap-2 ${isFullscreen ? "py-2 px-3 shrink-0" : "gap-3"}`}>
            <div className="p-1.5 bg-emerald-100 rounded-lg"><Zap className="h-3.5 w-3.5 text-emerald-600" /></div>
            <CardTitle className={isFullscreen ? "text-xs font-medium" : "text-base font-medium"}>
              {language === "th" ? "สัดส่วนพลังงาน" : "Energy Mix"}
            </CardTitle>
          </CardHeader>
          <CardContent className={isFullscreen ? "flex-1 min-h-0 p-2" : "p-6 pt-0"}>
            {energyMixData.length > 0 ? (
              <ResponsiveContainer width="100%" height={isFullscreen ? "100%" : 260}>
                <PieChart>
                  <Pie data={energyMixData} cx="50%" cy="50%" innerRadius={isFullscreen ? 35 : 60} outerRadius={isFullscreen ? 70 : 100} paddingAngle={3} dataKey="value">
                    {energyMixData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => { const item = energyMixData.find(d => d.name === name); return [`${value.toLocaleString()} ${item?.unit || ""}`, name]; }} />
                  {!isFullscreen && <Legend />}
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูลพลังงาน" : "No energy data"} />
            )}
          </CardContent>
        </Card>

        {/* 4. Water Balance Monthly */}
        <Card className={`bg-card/80 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl ${isFullscreen ? "flex flex-col min-h-0 overflow-hidden" : "rounded-3xl"}`}>
          <CardHeader className={`flex flex-row items-center gap-2 ${isFullscreen ? "py-2 px-3 shrink-0" : "gap-3"}`}>
            <div className="p-1.5 bg-emerald-100 rounded-lg"><Droplets className="h-3.5 w-3.5 text-emerald-600" /></div>
            <CardTitle className={isFullscreen ? "text-xs font-medium" : "text-base font-medium"}>
              {language === "th" ? "สมดุลน้ำรายเดือน" : "Monthly Water Balance"}
            </CardTitle>
          </CardHeader>
          <CardContent className={isFullscreen ? "flex-1 min-h-0 p-2" : "p-6 pt-0"}>
            {hasWaterBalanceData ? (
              isFullscreen ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={waterBalanceData.filter(d => d.withdrawal !== null)} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                    <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => [`${value.toLocaleString()} m³`, name]} labelFormatter={(label) => `📅 ${label}`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="withdrawal" name={language === "th" ? "น้ำเข้า" : "Withdrawal"} fill="hsl(199 89% 48%)" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                    <Line type="monotone" dataKey="recycling" name={language === "th" ? "นำกลับใช้" : "Recycling"} stroke="hsl(142 71% 45%)" strokeWidth={1.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ChartScrollWrapper dataLength={waterBalanceData.length} minBarWidth={52} height={300}>
                  <ComposedChart data={waterBalanceData.filter(d => d.withdrawal !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => [`${value.toLocaleString()} m³`, name]} labelFormatter={(label) => `📅 ${label}`} />
                    <Legend />
                    <Bar dataKey="withdrawal" name={language === "th" ? "น้ำเข้า" : "Withdrawal"} fill="hsl(199 89% 48%)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="recycling" name={language === "th" ? "นำกลับใช้" : "Recycling"} stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="discharge" name={language === "th" ? "ปล่อยออก" : "Discharge"} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </ComposedChart>
                </ChartScrollWrapper>
              )
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูลน้ำ" : "No water data"} />
            )}
          </CardContent>
        </Card>

        {/* Extra charts - hidden in TV mode */}
        {!isFullscreen && (
          <>
            {/* Electricity Monthly */}
            <Card className="lg:col-span-2 bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl"><Zap className="h-4 w-4 text-emerald-600" /></div>
                <div>
                  <CardTitle className="text-base font-medium">
                    {language === "th" ? "ปริมาณการใช้ไฟฟ้ารายเดือน (Grid vs Renewable)" : "Monthly Electricity (Grid vs Renewable)"}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{language === "th" ? "หน่วย: kWh" : "Unit: kWh"}</p>
                </div>
              </CardHeader>
              <CardContent>
                {hasElectricityData ? (
                  <ChartScrollWrapper dataLength={electricityChartData.length} minBarWidth={52} height={300}>
                    <AreaChart data={electricityChartData.filter(d => d.grid !== null || d.renewable !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => [`${value.toLocaleString()} kWh`, name]} labelFormatter={(label) => `📅 ${label}`} />
                      <Legend />
                      <Area type="monotone" dataKey="grid" name={language === "th" ? "ไฟฟ้าโครงข่าย" : "Grid"} stackId="elec" stroke="hsl(45 93% 47%)" fill="hsl(45 93% 47%)" fillOpacity={0.5} />
                      <Area type="monotone" dataKey="renewable" name={language === "th" ? "พลังงานหมุนเวียน" : "Renewable"} stackId="elec" stroke="hsl(142 71% 45%)" fill="hsl(142 71% 45%)" fillOpacity={0.5} />
                    </AreaChart>
                  </ChartScrollWrapper>
                ) : (
                  <EmptyState message={language === "th" ? "ยังไม่มีข้อมูลไฟฟ้า" : "No electricity data"} />
                )}
              </CardContent>
            </Card>

            {/* Water by Site */}
            <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl"><Droplets className="h-4 w-4 text-emerald-600" /></div>
                <CardTitle className="text-base font-medium">
                  {language === "th" ? "น้ำแยกตามสถานที่" : "Water by Site"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {waterBySiteData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(300, waterBySiteData.length * 36 + 60)}>
                    <BarChart data={waterBySiteData} layout="vertical" margin={{ top: 10, right: 30, left: 8, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        width={130}
                        interval={0}
                        tickFormatter={(v: string) => (v && v.length > 18 ? v.slice(0, 17) + "…" : v)}
                      />
                      <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number) => [`${value.toLocaleString()} m³`, ""]} />
                      <Bar dataKey="withdrawal" name={language === "th" ? "ปริมาณน้ำ" : "Water"} fill="hsl(199 89% 48%)" fillOpacity={0.8} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data"} />
                )}
              </CardContent>
            </Card>

            {/* Waste Pie */}
            <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl"><Trash2 className="h-4 w-4 text-emerald-600" /></div>
                <CardTitle className="text-base font-medium">
                  {language === "th" ? "สัดส่วนการจัดการขยะ" : "Waste Diversion"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {wastePieData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={wastePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                          {wastePieData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                        </Pie>
                        <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => [`${(value / 1000).toFixed(1)} t`, name]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState message={language === "th" ? "ยังไม่มีข้อมูลขยะ" : "No waste data"} />
                )}
              </CardContent>
            </Card>

            {/* Waste Monthly */}
            <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl"><Trash2 className="h-4 w-4 text-emerald-600" /></div>
                <CardTitle className="text-base font-medium">
                  {language === "th" ? "ขยะรายเดือน" : "Monthly Waste"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasWasteChartData ? (
                  <ChartScrollWrapper dataLength={wasteChartData.length} minBarWidth={52} height={300}>
                    <ComposedChart data={wasteChartData.filter(d => d.total !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={glassTooltipStyle} formatter={(value: number, name: string) => [`${(value / 1000).toFixed(1)} t`, name]} labelFormatter={(label) => `📅 ${label}`} />
                      <Legend />
                      <Bar dataKey="total" name={language === "th" ? "ขยะทั้งหมด" : "Total Waste"} fill="hsl(25 95% 53%)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="recycled" name={language === "th" ? "Recycle/Reuse" : "Recycled"} stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ChartScrollWrapper>
                ) : (
                  <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Summary Table - hidden in TV mode */}
      {!isFullscreen && summaryTableData.length > 0 && (
        <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl"><Leaf className="h-4 w-4 text-emerald-600" /></div>
            <div>
              <CardTitle className="text-base font-medium">
                {language === "th" ? "สรุปตัวชี้วัดด้านสิ่งแวดล้อม" : "Environmental Metrics Summary"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isAllTime
                  ? (language === "th" ? `เปรียบเทียบทุกปี (${tableYears.join(", ")})` : `All years comparison (${tableYears.join(", ")})`)
                  : (language === "th" ? `เปรียบเทียบ ${selectedYear} vs ${prevYear}` : `${selectedYear} vs ${prevYear} comparison`)}
              </p>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">{language === "th" ? "ตัวชี้วัด" : "Metric"}</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{language === "th" ? "หน่วย" : "Unit"}</th>
                  {tableYears.map(y => (
                    <th key={y} className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{y}</th>
                  ))}
                  {tableYears.length >= 2 && (
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">YoY</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {summaryTableData.map(row => (
                  <tr key={row.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 text-xs">{row.name}</td>
                    <td className="py-2.5 px-3 text-xs text-right text-muted-foreground">{row.unit}</td>
                    {tableYears.map((y, i) => (
                      <td key={y} className={`py-2.5 px-3 text-xs text-right ${i === 0 ? "font-medium" : "text-muted-foreground"}`}>
                        {(row.yearData[y] || 0) > 0 ? row.yearData[y].toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}
                      </td>
                    ))}
                    {tableYears.length >= 2 && (
                      <td className="py-2.5 px-3 text-xs text-right">
                        {row.change !== null ? (
                          <span className={`inline-flex items-center gap-0.5 ${row.change < 0 ? "text-emerald-600" : row.change > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {row.change > 0 ? <TrendingUp className="h-3 w-3" /> : row.change < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                            {row.change > 0 ? "+" : ""}{row.change.toFixed(1)}%
                          </span>
                        ) : "-"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
