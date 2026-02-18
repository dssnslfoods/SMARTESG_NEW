import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Leaf,
  Heart,
  Shield,
  Globe,
  BarChart3,
  Factory,
  Droplets,
  Trash2,
  GraduationCap,
  AlertTriangle,
  Gavel,
  ChevronRight,
  Zap,
  Activity,
  Clock,
} from "lucide-react";
import {
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
} from "recharts";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh";
import { ReportsLoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { ChartScrollWrapper } from "@/components/reports/ChartScrollWrapper";
import { FullscreenButton, useFullscreen } from "@/components/reports/FullscreenButton";

// ─── All Key Metric IDs across E, S, G ───
const ENV_METRICS = {
  GHG_SCOPE1: "MET003",
  GHG_SCOPE2: "MET004",
  GRID_ELECTRICITY: "MET001",
  RENEWABLE_ENERGY: "MET002",
  WATER_WITHDRAWAL: "MET005",
  WATER_RECYCLING: "MET006",
  TOTAL_WASTE: "MET018",
  WASTE_RECYCLED: "MET021",
};

const SOCIAL_METRICS = {
  TRAINING_HOURS: "MET008",
  LTI: "MET009",
  WELLBEING_ACCESS: "MET010",
  HUMAN_RIGHTS_VIOLATIONS: "MET017",
  FOOD_DONATION: "MET020",
  WORKING_HOURS: "MET035",
};

const GOV_METRICS = {
  GOVERNANCE_INCIDENTS: "MET012",
  CORRUPTION_INCIDENTS: "MET014",
  EMERGING_RISK: "MET013",
  TAX_TRAINING: "MET015",
};

const ALL_METRIC_IDS = [
  ...Object.values(ENV_METRICS),
  ...Object.values(SOCIAL_METRICS),
  ...Object.values(GOV_METRICS),
];

// ─── Interfaces ───
interface Company { company_id: string; company_name: string; }
interface Site { site_id: string; site_name: string; company_id: string; }
interface ReportingPeriod { period_id: string; year: number; month: number; month_name: string; }
interface MetricValue {
  value_id: string; metric_id: string; site_id: string; period_id: string;
  value: number; status: string; last_updated: string | null;
}

// ─── Shared ───
const glassTooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(229, 231, 235, 0.5)",
  borderRadius: "12px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
    <BarChart3 className="h-10 w-10 mb-2 opacity-50" />
    <p className="text-sm">{message}</p>
  </div>
);

// ─── Paginated Fetch ───
async function fetchAllMetricValues(): Promise<MetricValue[]> {
  const PAGE_SIZE = 2000;
  const allValues: MetricValue[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("metric_value")
      .select("value_id, metric_id, site_id, period_id, value, status, last_updated")
      .in("metric_id", ALL_METRIC_IDS)
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

function sumByMetric(values: MetricValue[], metricId: string): number {
  return values.filter(v => v.metric_id === metricId).reduce((s, v) => s + v.value, 0);
}
function sumByMetrics(values: MetricValue[], ids: string[]): number {
  return values.filter(v => ids.includes(v.metric_id)).reduce((s, v) => s + v.value, 0);
}

// ─── Dimension Score Card ───
const DimensionCard = ({
  title,
  icon: Icon,
  color,
  kpis,
  href,
  language,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  kpis: { label: string; value: string | number; unit: string; trend?: "up" | "down" | "neutral" | null; trendValue?: string | null; trendContext?: "positive" | "negative" }[];
  href: string;
  language: string;
}) => {
  const navigate = useNavigate();
  return (
    <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl overflow-hidden">
      {/* Color accent top */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate(href)}
        >
          {language === "th" ? "ดูรายละเอียด" : "View Details"}
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {kpis.map((kpi, idx) => {
            const context = kpi.trendContext || "positive";
            const getTrendColor = () => {
              if (!kpi.trend || kpi.trend === "neutral") return "text-muted-foreground";
              if (context === "positive") return kpi.trend === "up" ? "text-emerald-600" : "text-destructive";
              return kpi.trend === "down" ? "text-emerald-600" : "text-destructive";
            };
            return (
              <div key={idx} className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground truncate mb-1">{kpi.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{kpi.value}</span>
                  <span className="text-xs text-muted-foreground">{kpi.unit}</span>
                </div>
                {kpi.trend && kpi.trendValue && (
                  <div className={`flex items-center gap-0.5 text-xs mt-0.5 ${getTrendColor()}`}>
                    {kpi.trend === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    <span>{kpi.trendValue}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main Component ───
export default function ESGOverview() {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(fullscreenRef);
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
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
        allValues,
      ] = await Promise.all([
        supabase.from("company").select("*").order("company_name"),
        supabase.from("site").select("*").order("site_name"),
        supabase.from("reporting_period").select("*").order("year", { ascending: false }),
        fetchAllMetricValues(),
      ]);

      setCompanies(companiesData || []);
      setSites(sitesData || []);
      setPeriods(periodsData || []);
      setMetricValues(allValues);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Computed ───
  const uniqueYears = useMemo(() => [...new Set(periods.map(p => p.year))].sort((a, b) => b - a), [periods]);
  const isAllTime = !filterYear || filterYear === "__all__";
  const selectedYear = (!isAllTime && filterYear) ? parseInt(filterYear) : uniqueYears[0];
  const prevYear = isAllTime ? null : (selectedYear ? selectedYear - 1 : null);

  const filteredSites = useMemo(() =>
    filterCompany ? sites.filter(s => s.company_id === filterCompany) : sites,
    [sites, filterCompany]
  );

  // When a specific year is selected, filter to that year.
  // When "All Time", filteredValues = all data (for charts/totals),
  // but we also compute latestYearValues for the summary table.
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

  // For summary table: values for the latest year only (used when "All Time")
  const latestYearValues = useMemo(() => {
    if (!isAllTime) return filteredValues;
    return metricValues.filter(v => {
      if (filterCompany) {
        const site = sites.find(s => s.site_id === v.site_id);
        if (site?.company_id !== filterCompany) return false;
      }
      if (filterSite && v.site_id !== filterSite) return false;
      const period = periods.find(p => p.period_id === v.period_id);
      return period?.year === selectedYear;
    });
  }, [metricValues, isAllTime, filteredValues, filterCompany, filterSite, selectedYear, sites, periods]);

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

  // ─── YoY Helper (uses latestYearValues for accurate comparison) ───
  const calcYoY = (metricId: string, context: "positive" | "negative" = "positive") => {
    const curr = sumByMetric(latestYearValues, metricId);
    const prev = sumByMetric(prevYearValues, metricId);
    if (prevYearValues.length === 0) return { trend: null as "up" | "down" | "neutral" | null, trendValue: null as string | null };
    if (prev === 0 && curr === 0) return { trend: "neutral" as const, trendValue: "0%" };
    if (prev === 0) return { trend: "up" as const, trendValue: "+100%" };
    const change = ((curr - prev) / prev) * 100;
    return {
      trend: (change > 0 ? "up" : change < 0 ? "down" : "neutral") as "up" | "down" | "neutral",
      trendValue: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    };
  };

  const calcMultiYoY = (ids: string[], context: "positive" | "negative" = "positive") => {
    const curr = sumByMetrics(latestYearValues, ids);
    const prev = sumByMetrics(prevYearValues, ids);
    if (prevYearValues.length === 0) return { trend: null as "up" | "down" | "neutral" | null, trendValue: null as string | null };
    if (prev === 0 && curr === 0) return { trend: "neutral" as const, trendValue: "0%" };
    if (prev === 0) return { trend: "up" as const, trendValue: "+100%" };
    const change = ((curr - prev) / prev) * 100;
    return {
      trend: (change > 0 ? "up" : change < 0 ? "down" : "neutral") as "up" | "down" | "neutral",
      trendValue: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    };
  };

  // ─── KPI values (from latestYearValues for accurate single-year display) ───
  const totalGHG = sumByMetrics(latestYearValues, [ENV_METRICS.GHG_SCOPE1, ENV_METRICS.GHG_SCOPE2]);
  const totalEnergy = sumByMetrics(latestYearValues, [ENV_METRICS.GRID_ELECTRICITY, ENV_METRICS.RENEWABLE_ENERGY]);
  const totalWater = sumByMetric(latestYearValues, ENV_METRICS.WATER_WITHDRAWAL);
  const totalWaste = sumByMetric(latestYearValues, ENV_METRICS.TOTAL_WASTE);
  const wasteRecycled = sumByMetric(latestYearValues, ENV_METRICS.WASTE_RECYCLED);
  const renewableEnergy = sumByMetric(latestYearValues, ENV_METRICS.RENEWABLE_ENERGY);

  const totalTraining = sumByMetric(latestYearValues, SOCIAL_METRICS.TRAINING_HOURS);
  const totalLTI = sumByMetric(latestYearValues, SOCIAL_METRICS.LTI);
  const totalWellbeing = sumByMetric(latestYearValues, SOCIAL_METRICS.WELLBEING_ACCESS);
  const totalWorkingHours = sumByMetric(latestYearValues, SOCIAL_METRICS.WORKING_HOURS);
  const ltifr = totalWorkingHours > 0 ? (totalLTI * 1_000_000) / totalWorkingHours : 0;

  const totalGovIncidents = sumByMetric(latestYearValues, GOV_METRICS.GOVERNANCE_INCIDENTS);
  const totalCorruption = sumByMetric(latestYearValues, GOV_METRICS.CORRUPTION_INCIDENTS);
  const totalTaxTraining = sumByMetric(latestYearValues, GOV_METRICS.TAX_TRAINING);

  // Renewable %
  const renewablePercent = totalEnergy > 0 ? ((renewableEnergy / totalEnergy) * 100).toFixed(1) : "0";
  // Waste diversion rate
  const wasteDiversionRate = totalWaste > 0 ? ((wasteRecycled / totalWaste) * 100).toFixed(1) : "0";

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

  // ─── Dimension Distribution (Pie) ───
  const dimensionDistribution = useMemo(() => {
    const envIds = new Set(Object.values(ENV_METRICS));
    const socIds = new Set(Object.values(SOCIAL_METRICS));
    const govIds = new Set(Object.values(GOV_METRICS));
    const envCount = filteredValues.filter(v => envIds.has(v.metric_id)).length;
    const socCount = filteredValues.filter(v => socIds.has(v.metric_id)).length;
    const govCount = filteredValues.filter(v => govIds.has(v.metric_id)).length;
    return [
      { name: language === "th" ? "สิ่งแวดล้อม" : "Environmental", value: envCount, color: "hsl(142 71% 45%)" },
      { name: language === "th" ? "สังคม" : "Social", value: socCount, color: "hsl(217 91% 60%)" },
      { name: language === "th" ? "ธรรมาภิบาล" : "Governance", value: govCount, color: "hsl(262 83% 58%)" },
    ].filter(d => d.value > 0);
  }, [filteredValues, language]);

  // ─── Monthly Trend by Dimension ───
  const monthlyDimensionTrend = useMemo(() => {
    const envIds = new Set(Object.values(ENV_METRICS));
    const socIds = new Set(Object.values(SOCIAL_METRICS));
    const govIds = new Set(Object.values(GOV_METRICS));

    // Show ALL periods with data across all years when in All Time mode
    const periodsWithData = new Set(filteredValues.map(v => v.period_id));
    const allRelevant = periods.filter(p => periodsWithData.has(p.period_id));

    let chartPeriods: typeof periods;
    if (isAllTime) {
      chartPeriods = allRelevant.length > 0
        ? allRelevant.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
        : periods.filter(p => p.year === selectedYear).sort((a, b) => a.month - b.month);
    } else {
      chartPeriods = periods.filter(p => p.year === selectedYear).sort((a, b) => a.month - b.month);
    }

    return chartPeriods
      .map(period => {
        const pvs = filteredValues.filter(v => v.period_id === period.period_id);
        const label = isAllTime
          ? `${period.month_name.slice(0, 3)} '${String(period.year).slice(2)}`
          : period.month_name.slice(0, 3);
        return {
          name: label,
          environmental: pvs.filter(v => envIds.has(v.metric_id)).length,
          social: pvs.filter(v => socIds.has(v.metric_id)).length,
          governance: pvs.filter(v => govIds.has(v.metric_id)).length,
        };
      });
  }, [filteredValues, periods, selectedYear]);

  // ─── ESG Radar ───
  const esgRadarData = useMemo(() => [
    { subject: language === "th" ? "GHG" : "GHG", value: totalGHG > 0 ? Math.min(totalGHG / 100, 100) : 0, fullMark: 100 },
    { subject: language === "th" ? "พลังงาน" : "Energy", value: totalEnergy > 0 ? Math.min(totalEnergy / 10000, 100) : 0, fullMark: 100 },
    { subject: language === "th" ? "น้ำ" : "Water", value: totalWater > 0 ? Math.min(totalWater / 1000, 100) : 0, fullMark: 100 },
    { subject: language === "th" ? "อบรม" : "Training", value: totalTraining > 0 ? Math.min(totalTraining / 1000, 100) : 0, fullMark: 100 },
    { subject: language === "th" ? "ความปลอดภัย" : "Safety", value: totalLTI === 0 ? 100 : Math.max(100 - totalLTI * 10, 0), fullMark: 100 },
    { subject: language === "th" ? "ธรรมาภิบาล" : "Governance", value: totalGovIncidents + totalCorruption === 0 ? 100 : Math.max(100 - (totalGovIncidents + totalCorruption) * 20, 0), fullMark: 100 },
  ], [totalGHG, totalEnergy, totalWater, totalTraining, totalLTI, totalGovIncidents, totalCorruption, language]);
  // ─── Years with data ───
  const yearsWithData = useMemo(() => {
    const yearSet = new Set<number>();
    metricValues.forEach(v => {
      const p = periods.find(pp => pp.period_id === v.period_id);
      if (p) yearSet.add(p.year);
    });
    return [...yearSet].sort((a, b) => b - a);
  }, [metricValues, periods]);

  const tableYears = useMemo(() => isAllTime ? yearsWithData : (prevYear ? [selectedYear, prevYear] : [selectedYear]), [isAllTime, yearsWithData, selectedYear, prevYear]);

  // ─── Summary Table ───
  const summaryData = useMemo(() => {
    const items = [
      // Environmental
      { dim: "E", label: language === "th" ? "GHG Scope 1+2" : "GHG Scope 1+2", ids: [ENV_METRICS.GHG_SCOPE1, ENV_METRICS.GHG_SCOPE2], unit: "tCO2e", context: "negative" as const },
      { dim: "E", label: language === "th" ? "พลังงานรวม" : "Total Energy", ids: [ENV_METRICS.GRID_ELECTRICITY, ENV_METRICS.RENEWABLE_ENERGY], unit: "kWh", context: "negative" as const },
      { dim: "E", label: language === "th" ? "น้ำที่ใช้" : "Water Withdrawal", ids: [ENV_METRICS.WATER_WITHDRAWAL], unit: "m³", context: "negative" as const },
      { dim: "E", label: language === "th" ? "ขยะทั้งหมด" : "Total Waste", ids: [ENV_METRICS.TOTAL_WASTE], unit: "kg", context: "negative" as const },
      // Social
      { dim: "S", label: language === "th" ? "ชั่วโมงอบรม" : "Training Hours", ids: [SOCIAL_METRICS.TRAINING_HOURS], unit: language === "th" ? "ชม." : "hrs", context: "positive" as const },
      { dim: "S", label: language === "th" ? "LTI" : "LTI", ids: [SOCIAL_METRICS.LTI], unit: language === "th" ? "ครั้ง" : "cases", context: "negative" as const },
      { dim: "S", label: language === "th" ? "Well-being" : "Well-being Access", ids: [SOCIAL_METRICS.WELLBEING_ACCESS], unit: language === "th" ? "คน" : "people", context: "positive" as const },
      // Governance
      { dim: "G", label: language === "th" ? "เหตุการณ์ธรรมาภิบาล" : "Gov. Incidents", ids: [GOV_METRICS.GOVERNANCE_INCIDENTS], unit: language === "th" ? "เรื่อง" : "cases", context: "negative" as const },
      { dim: "G", label: language === "th" ? "เหตุการณ์ทุจริต" : "Corruption", ids: [GOV_METRICS.CORRUPTION_INCIDENTS], unit: language === "th" ? "ข้อ" : "cases", context: "negative" as const },
    ];

    if (isAllTime) {
      return items.map(item => {
        const yearData: Record<number, number> = {};
        filteredValues.forEach(v => {
          if (!item.ids.includes(v.metric_id)) return;
          const period = periods.find(p => p.period_id === v.period_id);
          if (!period) return;
          yearData[period.year] = (yearData[period.year] || 0) + v.value;
        });
        const latestTwo = yearsWithData.slice(0, 2);
        const curr = yearData[latestTwo[0]] || 0;
        const prev = latestTwo.length > 1 ? (yearData[latestTwo[1]] || 0) : 0;
        let changePercent: number | null = null;
        if (prev > 0) changePercent = ((curr - prev) / prev) * 100;
        else if (curr > 0) changePercent = 100;
        return { ...item, yearData, changePercent };
      });
    }

    return items.map(item => {
      const curr = sumByMetrics(latestYearValues, item.ids);
      const prev = sumByMetrics(prevYearValues, item.ids);
      const hasCurrData = latestYearValues.some(v => item.ids.includes(v.metric_id));
      const hasPrevData = prevYearValues.some(v => item.ids.includes(v.metric_id));
      let changePercent: number | null = null;
      if (hasPrevData && prev > 0) changePercent = ((curr - prev) / prev) * 100;
      else if (hasPrevData && curr > 0) changePercent = 100;
      else if (hasPrevData) changePercent = 0;

      const yearData: Record<number, number> = {};
      if (hasCurrData) yearData[selectedYear] = curr;
      if (hasPrevData && prevYear) yearData[prevYear] = prev;

      return { ...item, yearData, changePercent };
    });
  }, [filteredValues, latestYearValues, prevYearValues, language, isAllTime, periods, yearsWithData, selectedYear, prevYear]);

  const getDimColor = (dim: string) => {
    if (dim === "E") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    if (dim === "S") return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    return "bg-purple-500/10 text-purple-700 border-purple-500/20";
  };

  if (loading) return <ReportsLoadingSkeleton />;

  return (
    <div
      ref={fullscreenRef}
      className={isFullscreen
        ? "h-screen overflow-hidden bg-background flex flex-col p-3 gap-2"
        : "space-y-6 pb-8 bg-gradient-to-br from-background via-background to-primary/5 min-h-screen -m-6 p-6"
      }
    >
      <div ref={containerRef} />
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Multi-color accent */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            {language === "th" ? "ESG Overview Dashboard" : "ESG Overview Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th"
              ? "ภาพรวมตัวชี้วัดด้าน สิ่งแวดล้อม สังคม และธรรมาภิบาล"
              : "Overview of Environmental, Social & Governance metrics"}
          </p>
          {hasData && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {filteredValues.length.toLocaleString()} {language === "th" ? "รายการ" : "records"}
              </Badge>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                {isAllTime
                  ? (language === "th" ? "เวลาทั้งหมด" : "All Time")
                  : (language === "th" ? `ปี ${selectedYear}` : `Year ${selectedYear}`)}
              </Badge>
              {formatLastUpdated(lastUpdated) && (
                <Badge variant="outline" className="text-xs bg-muted/60 text-muted-foreground border-border/50 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {language === "th" ? "อัปเดตล่าสุด" : "Last updated"}: {formatLastUpdated(lastUpdated)}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FullscreenButton targetRef={fullscreenRef} language={language} isFullscreen={isFullscreen} toggle={toggleFullscreen} />
          <ExportExcelButton
            data={summaryData.map(row => {
              const exportRow: Record<string, unknown> = {
                [language === "th" ? "มิติ" : "Dimension"]: row.dim,
                [language === "th" ? "ตัวชี้วัด" : "Metric"]: row.label,
                [language === "th" ? "หน่วย" : "Unit"]: row.unit,
              };
              tableYears.forEach(y => { exportRow[language === "th" ? `ค่าปี ${y}` : `Value ${y}`] = row.yearData[y] ?? "-"; });
              if (tableYears.length >= 2) {
                exportRow[language === "th" ? "เปลี่ยนแปลง (%)" : "Change (%)"] = row.changePercent !== null ? `${row.changePercent >= 0 ? "+" : ""}${row.changePercent.toFixed(1)}%` : "-";
              }
              return exportRow;
            })}
            filenamePrefix="esg_overview_report"
            sourcePage="ESG Overview Dashboard"
            appliedFilters={{
              company: filterCompany ? companies.find(c => c.company_id === filterCompany)?.company_name || filterCompany : "All",
              site: filterSite ? sites.find(s => s.site_id === filterSite)?.site_name || filterSite : "All",
              year: isAllTime ? "All Time" : String(selectedYear),
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "บริษัท" : "Company"}</Label>
              <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v === "__all__" ? "" : v); setFilterSite(""); }}>
                <SelectTrigger className="h-9 bg-card/60 backdrop-blur border-border/80 rounded-xl focus:ring-2 focus:ring-primary/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50 rounded-xl">
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.company_id} value={c.company_id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "สถานที่" : "Site"}</Label>
              <Select value={filterSite} onValueChange={(v) => setFilterSite(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-9 bg-card/60 backdrop-blur border-border/80 rounded-xl focus:ring-2 focus:ring-primary/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50 rounded-xl">
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {filteredSites.map(s => (
                    <SelectItem key={s.site_id} value={s.site_id}>{s.site_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "ปี" : "Year"}</Label>
              <Select value={filterYear} onValueChange={(v) => setFilterYear(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-9 bg-card/60 backdrop-blur border-border/80 rounded-xl focus:ring-2 focus:ring-primary/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50 rounded-xl">
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {uniqueYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top-Level KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "GHG", value: totalGHG.toLocaleString(), unit: "tCO2e", icon: Factory, color: "hsl(142 71% 45%)", yoy: calcMultiYoY([ENV_METRICS.GHG_SCOPE1, ENV_METRICS.GHG_SCOPE2], "negative"), ctx: "negative" as const },
          { label: language === "th" ? "พลังงานสะอาด" : "Renewable %", value: `${renewablePercent}`, unit: "%", icon: Zap, color: "hsl(45 93% 47%)", yoy: { trend: null, trendValue: null } as { trend: null; trendValue: null }, ctx: "positive" as const },
          { label: language === "th" ? "น้ำ" : "Water", value: totalWater.toLocaleString(), unit: "m³", icon: Droplets, color: "hsl(199 89% 48%)", yoy: calcYoY(ENV_METRICS.WATER_WITHDRAWAL, "negative"), ctx: "negative" as const },
          { label: language === "th" ? "อบรม" : "Training", value: totalTraining.toLocaleString(), unit: language === "th" ? "ชม." : "hrs", icon: GraduationCap, color: "hsl(217 91% 60%)", yoy: calcYoY(SOCIAL_METRICS.TRAINING_HOURS, "positive"), ctx: "positive" as const },
        ].map((kpi, i) => {
          const ctx = kpi.ctx;
          const getTrendColor = () => {
            if (!kpi.yoy.trend || kpi.yoy.trend === "neutral") return "text-muted-foreground";
            if (ctx === "positive") return kpi.yoy.trend === "up" ? "text-emerald-600" : "text-destructive";
            return kpi.yoy.trend === "down" ? "text-emerald-600" : "text-destructive";
          };
          return (
            <Card key={i} className="bg-card/70 backdrop-blur-xl border-border/50 shadow-lg rounded-2xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <kpi.icon className="h-3.5 w-3.5" style={{ color: kpi.color }} />
                  <span className="text-xs text-muted-foreground truncate">{kpi.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{kpi.value}</span>
                  {kpi.unit && <span className="text-xs text-muted-foreground">{kpi.unit}</span>}
                </div>
                {kpi.yoy.trend && kpi.yoy.trendValue && (
                  <div className={`flex items-center gap-0.5 text-xs mt-0.5 ${getTrendColor()}`}>
                    {kpi.yoy.trend === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    <span>{kpi.yoy.trendValue}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dimension Detail Cards */}
      <div className="space-y-4">
        {/* Environmental */}
        <DimensionCard
          title={language === "th" ? "สิ่งแวดล้อม (Environmental)" : "Environmental"}
          icon={Leaf}
          color="hsl(142 71% 45%)"
          href="/reports/environmental"
          language={language}
          kpis={[
            { label: "GHG Scope 1", value: sumByMetric(latestYearValues, ENV_METRICS.GHG_SCOPE1).toLocaleString(), unit: "tCO2e", ...calcYoY(ENV_METRICS.GHG_SCOPE1, "negative"), trendContext: "negative" },
            { label: "GHG Scope 2", value: sumByMetric(latestYearValues, ENV_METRICS.GHG_SCOPE2).toLocaleString(), unit: "tCO2e", ...calcYoY(ENV_METRICS.GHG_SCOPE2, "negative"), trendContext: "negative" },
            { label: language === "th" ? "ไฟฟ้า Grid" : "Grid Electricity", value: sumByMetric(latestYearValues, ENV_METRICS.GRID_ELECTRICITY).toLocaleString(), unit: "kWh", ...calcYoY(ENV_METRICS.GRID_ELECTRICITY, "negative"), trendContext: "negative" },
            { label: language === "th" ? "พลังงานหมุนเวียน" : "Renewable", value: renewableEnergy.toLocaleString(), unit: "kWh", ...calcYoY(ENV_METRICS.RENEWABLE_ENERGY, "positive"), trendContext: "positive" },
            { label: language === "th" ? "น้ำที่ใช้" : "Water", value: totalWater.toLocaleString(), unit: "m³", ...calcYoY(ENV_METRICS.WATER_WITHDRAWAL, "negative"), trendContext: "negative" },
            { label: language === "th" ? "ขยะ Diversion" : "Waste Diversion", value: `${wasteDiversionRate}`, unit: "%", trend: null, trendValue: null },
          ]}
        />

        {/* Social */}
        <DimensionCard
          title={language === "th" ? "สังคม (Social)" : "Social"}
          icon={Heart}
          color="hsl(217 91% 60%)"
          href="/reports/social"
          language={language}
          kpis={[
            { label: language === "th" ? "ชั่วโมงอบรม" : "Training Hrs", value: totalTraining.toLocaleString(), unit: language === "th" ? "ชม." : "hrs", ...calcYoY(SOCIAL_METRICS.TRAINING_HOURS, "positive"), trendContext: "positive" },
            { label: "LTI", value: totalLTI.toLocaleString(), unit: language === "th" ? "ครั้ง" : "cases", ...calcYoY(SOCIAL_METRICS.LTI, "negative"), trendContext: "negative" },
            { label: "LTIFR", value: ltifr.toFixed(2), unit: "", trend: null, trendValue: null },
            { label: "Well-being", value: totalWellbeing.toLocaleString(), unit: language === "th" ? "คน" : "people", ...calcYoY(SOCIAL_METRICS.WELLBEING_ACCESS, "positive"), trendContext: "positive" },
            { label: language === "th" ? "บริจาคอาหาร" : "Food Donation", value: sumByMetric(latestYearValues, SOCIAL_METRICS.FOOD_DONATION).toLocaleString(), unit: "kg", ...calcYoY(SOCIAL_METRICS.FOOD_DONATION, "positive"), trendContext: "positive" },
            { label: language === "th" ? "ชม.ทำงาน" : "Working Hrs", value: totalWorkingHours.toLocaleString(), unit: language === "th" ? "ชม." : "hrs", ...calcYoY(SOCIAL_METRICS.WORKING_HOURS), trendContext: "positive" },
          ]}
        />

        {/* Governance */}
        <DimensionCard
          title={language === "th" ? "ธรรมาภิบาล (Governance)" : "Governance"}
          icon={Shield}
          color="hsl(262 83% 58%)"
          href="/reports/governance"
          language={language}
          kpis={[
            { label: language === "th" ? "เหตุการณ์กำกับดูแล" : "Gov. Incidents", value: totalGovIncidents.toLocaleString(), unit: language === "th" ? "เรื่อง" : "cases", ...calcYoY(GOV_METRICS.GOVERNANCE_INCIDENTS, "negative"), trendContext: "negative" },
            { label: language === "th" ? "ทุจริต/คอรัปชั่น" : "Corruption", value: totalCorruption.toLocaleString(), unit: language === "th" ? "ข้อ" : "cases", ...calcYoY(GOV_METRICS.CORRUPTION_INCIDENTS, "negative"), trendContext: "negative" },
            { label: language === "th" ? "อบรมภาษี" : "Tax Training", value: totalTaxTraining.toLocaleString(), unit: language === "th" ? "คน" : "people", ...calcYoY(GOV_METRICS.TAX_TRAINING, "positive"), trendContext: "positive" },
          ]}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ESG Data Distribution Pie */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "สัดส่วนข้อมูล ESG" : "ESG Data Distribution"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dimensionDistribution.length === 0 ? (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data"} />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={dimensionDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {dimensionDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={glassTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly Records by Dimension */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "จำนวนข้อมูลรายเดือน" : "Monthly Records by Dimension"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyDimensionTrend.length === 0 ? (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data"} />
            ) : (
              <ChartScrollWrapper dataLength={monthlyDimensionTrend.length} minBarWidth={44} height={250}>
                <BarChart data={monthlyDimensionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={glassTooltipStyle} labelFormatter={(label) => `📅 ${label}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="environmental" name={language === "th" ? "สิ่งแวดล้อม" : "Environmental"} stackId="a" fill="hsl(142 71% 45%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="social" name={language === "th" ? "สังคม" : "Social"} stackId="a" fill="hsl(217 91% 60%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="governance" name={language === "th" ? "ธรรมาภิบาล" : "Governance"} stackId="a" fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartScrollWrapper>
            )}
          </CardContent>
        </Card>

        {/* ESG Radar */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "ESG Performance Radar" : "ESG Performance Radar"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data"} />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={esgRadarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                  <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip contentStyle={glassTooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base font-medium">
            {language === "th" ? "สรุปตัวชี้วัด ESG ทั้งหมด" : "Complete ESG Metrics Summary"}
          </CardTitle>
          <Badge variant="outline" className="ml-auto text-xs">
            {isAllTime
              ? (language === "th" ? `ทุกปี (${tableYears.join(", ")})` : `All years (${tableYears.join(", ")})`)
              : `${selectedYear} vs ${prevYear}`}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ESG</TableHead>
                  <TableHead className="min-w-[180px]">{language === "th" ? "ตัวชี้วัด" : "Metric"}</TableHead>
                  <TableHead className="text-center">{language === "th" ? "หน่วย" : "Unit"}</TableHead>
                  {tableYears.map(y => (
                    <TableHead key={y} className="text-right">{y}</TableHead>
                  ))}
                  {tableYears.length >= 2 && (
                    <TableHead className="text-right">{language === "th" ? "เปลี่ยนแปลง" : "Change"}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getDimColor(row.dim)}`}>{row.dim}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{row.label}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{row.unit}</TableCell>
                    {tableYears.map((y, i) => (
                      <TableCell key={y} className={`text-right ${i === 0 ? "font-semibold" : "text-muted-foreground"}`}>
                        {row.yearData[y] != null && row.yearData[y] > 0 ? row.yearData[y].toLocaleString() : row.yearData[y] === 0 ? "0" : "-"}
                      </TableCell>
                    ))}
                    {tableYears.length >= 2 && (
                      <TableCell className="text-right">
                        {row.changePercent !== null ? (
                          <Badge variant="outline" className={
                            row.changePercent === 0 ? "bg-muted text-muted-foreground"
                              : row.context === "negative"
                                ? row.changePercent <= 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                                : row.changePercent >= 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                          }>
                            {row.changePercent >= 0 ? "+" : ""}{row.changePercent.toFixed(1)}%
                          </Badge>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
