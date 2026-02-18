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
  Shield,
  FileCheck,
  AlertTriangle,
  BarChart3,
  Scale,
  GraduationCap,
  Gavel,
  Activity,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh";
import { ReportsLoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ExportExcelButton } from "@/components/ExportExcelButton";

// ─── Metric ID Constants ───
const METRIC = {
  GOVERNANCE_INCIDENTS: "MET012",   // จำนวนเหตุการณ์ด้านการกำกับดูแลและการเลือกปฏิบัติ
  EMERGING_RISK: "MET013",          // การประเมินความเสี่ยงเกิดใหม่
  CORRUPTION_INCIDENTS: "MET014",   // จำนวนเหตุการณ์ทุจริตและคอรัปชั่น
  TAX_TRAINING: "MET015",           // จำนวนผู้ได้รับการอบรมเรื่องการบริหารภาษี
};

const GOVERNANCE_METRIC_IDS = Object.values(METRIC);

// ─── Theme Mapping ───
const THEME_MAP: Record<string, { th: string; en: string; color: string }> = {
  THM007: { th: "Corporate Governance", en: "Corporate Governance", color: "hsl(262 83% 58%)" },
  THM013: { th: "Anti-Corruption", en: "Anti-Corruption", color: "hsl(0 84% 60%)" },
  THM008: { th: "Risk Management", en: "Risk Management", color: "hsl(45 93% 47%)" },
  THM010: { th: "Tax Strategy", en: "Tax Strategy", color: "hsl(199 89% 48%)" },
};

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
const GovKPICard = ({
  title, value, unit, icon: Icon, trend, trendValue, trendContext, sparklineData, color,
}: {
  title: string; value: string | number | null; unit: string; icon: React.ElementType;
  trend?: "up" | "down" | "neutral" | null; trendValue?: string | null;
  trendContext?: "positive" | "negative";
  sparklineData: number[]; color: string;
}) => {
  const context = trendContext || "negative"; // For governance, down (fewer incidents) is usually good
  const getTrendColor = () => {
    if (!trend || trend === "neutral") return "text-muted-foreground";
    if (context === "positive") return trend === "up" ? "text-emerald-600" : "text-destructive";
    return trend === "down" ? "text-emerald-600" : "text-destructive";
  };

  return (
    <Card className="flex-1 min-w-[220px] bg-card/70 backdrop-blur-xl border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
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
              <span className="text-xl sm:text-2xl font-bold text-foreground">{value !== null ? value : "-"}</span>
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
async function fetchGovernanceMetricValues(): Promise<MetricValue[]> {
  const PAGE_SIZE = 2000;
  const allValues: MetricValue[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("metric_value")
      .select("value_id, metric_id, site_id, period_id, value, status")
      .in("metric_id", GOVERNANCE_METRIC_IDS)
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

// ─── Main Component ───
export default function Governance() {
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
        govValues,
      ] = await Promise.all([
        supabase.from("company").select("*").order("company_name"),
        supabase.from("site").select("*").order("site_name"),
        supabase.from("reporting_period").select("*").order("year", { ascending: false }),
        supabase.from("esg_metric").select("*").in("metric_id", GOVERNANCE_METRIC_IDS),
        fetchGovernanceMetricValues(),
      ]);

      setCompanies(companiesData || []);
      setSites(sitesData || []);
      setPeriods(periodsData || []);
      setMetrics(metricsData || []);
      setMetricValues(govValues);

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
  const totalGovIncidents = sumByMetric(filteredValues, METRIC.GOVERNANCE_INCIDENTS);
  const totalCorruptionIncidents = sumByMetric(filteredValues, METRIC.CORRUPTION_INCIDENTS);
  const totalEmergingRisk = sumByMetric(filteredValues, METRIC.EMERGING_RISK);
  const totalTaxTraining = sumByMetric(filteredValues, METRIC.TAX_TRAINING);

  // Total incidents combined
  const totalIncidents = totalGovIncidents + totalCorruptionIncidents;

  // Check which metrics have data
  const hasGovIncidentData = filteredValues.some(v => v.metric_id === METRIC.GOVERNANCE_INCIDENTS);
  const hasCorruptionData = filteredValues.some(v => v.metric_id === METRIC.CORRUPTION_INCIDENTS);
  const hasEmergingRiskData = filteredValues.some(v => v.metric_id === METRIC.EMERGING_RISK);
  const hasTaxTrainingData = filteredValues.some(v => v.metric_id === METRIC.TAX_TRAINING);

  // ─── YoY Calculations ───
  const calcYoY = (currentVal: number, metricId: string, context: "positive" | "negative" = "negative"): { trend: "up" | "down" | "neutral" | null; value: string | null } => {
    const prev = sumByMetric(prevYearValues, metricId);
    if (prevYearValues.length === 0) return { trend: null, value: null };
    if (prev === 0 && currentVal === 0) return { trend: "neutral", value: "0%" };
    if (prev === 0) return { trend: "up", value: "+100%" };
    const change = ((currentVal - prev) / prev) * 100;
    return {
      trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
      value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    };
  };

  const govIncidentYoY = calcYoY(totalGovIncidents, METRIC.GOVERNANCE_INCIDENTS, "negative");
  const corruptionYoY = calcYoY(totalCorruptionIncidents, METRIC.CORRUPTION_INCIDENTS, "negative");
  const emergingRiskYoY = calcYoY(totalEmergingRisk, METRIC.EMERGING_RISK, "positive");
  const taxTrainingYoY = calcYoY(totalTaxTraining, METRIC.TAX_TRAINING, "positive");

  // ─── Helper: get relevant periods for charts ───
  const chartPeriods = useMemo(() => {
    if (isAllTime) {
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

  // Get values for a specific period_id
  const getPeriodValues = useCallback((periodId: string) => {
    return filteredValues.filter(v => v.period_id === periodId);
  }, [filteredValues]);

  // Period label: "Jan '25" in All Time mode
  const periodLabel = useCallback((period: { month_name: string; year: number }) => {
    return isAllTime
      ? `${period.month_name.slice(0, 3)} '${String(period.year).slice(2)}`
      : period.month_name.slice(0, 3);
  }, [isAllTime]);

  const getMonthValues = useCallback((month: number) => {
    if (isAllTime) {
      const monthPeriodIds = periods.filter(p => p.month === month).map(p => p.period_id);
      return filteredValues.filter(v => monthPeriodIds.includes(v.period_id));
    }
    const periodId = periods.find(p => p.year === selectedYear && p.month === month)?.period_id;
    return periodId ? filteredValues.filter(v => v.period_id === periodId) : [];
  }, [filteredValues, periods, selectedYear, isAllTime]);

  // ─── Sparkline Data (monthly) ───
  const getMonthlySparkline = (metricId: string): number[] => {
    return chartPeriods.map(period => {
      const pv = getPeriodValues(period.period_id);
      return pv.filter(v => v.metric_id === metricId).reduce((s, v) => s + v.value, 0);
    });
  };

  // ─── Chart 1: Monthly Governance Incidents Trend ───
  const monthlyIncidentData = useMemo(() => {
    return chartPeriods.map(period => {
      const pv = getPeriodValues(period.period_id);
      const govVal = pv.filter(v => v.metric_id === METRIC.GOVERNANCE_INCIDENTS).reduce((s, v) => s + v.value, 0);
      const corruptVal = pv.filter(v => v.metric_id === METRIC.CORRUPTION_INCIDENTS).reduce((s, v) => s + v.value, 0);
      return {
        name: periodLabel(period),
        governance: govVal,
        corruption: corruptVal,
        total: govVal + corruptVal,
      };
    });
  }, [chartPeriods, getPeriodValues, periodLabel]);

  // ─── Chart 2: Incidents by Site (Horizontal Bar) ───
  const incidentsBySite = useMemo(() => {
    const siteMap = new Map<string, { governance: number; corruption: number }>();
    filteredValues.forEach(v => {
      if (v.metric_id !== METRIC.GOVERNANCE_INCIDENTS && v.metric_id !== METRIC.CORRUPTION_INCIDENTS) return;
      const site = sites.find(s => s.site_id === v.site_id);
      if (!site) return;
      const current = siteMap.get(site.site_name) || { governance: 0, corruption: 0 };
      if (v.metric_id === METRIC.GOVERNANCE_INCIDENTS) current.governance += v.value;
      else current.corruption += v.value;
      siteMap.set(site.site_name, current);
    });
    return Array.from(siteMap.entries())
      .map(([name, data]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, ...data, total: data.governance + data.corruption }))
      .sort((a, b) => b.total - a.total);
  }, [filteredValues, sites]);

  // ─── Chart 3: Governance Theme Distribution (Pie) ───
  const themeDistribution = useMemo(() => {
    const themeMap = new Map<string, { count: number; value: number }>();
    filteredValues.forEach(v => {
      const metric = metrics.find(m => m.metric_id === v.metric_id);
      if (!metric) return;
      const theme = THEME_MAP[metric.theme_id];
      if (!theme) return;
      const label = language === "th" ? theme.th : theme.en;
      const current = themeMap.get(label) || { count: 0, value: 0 };
      current.count += 1;
      current.value += v.value;
      themeMap.set(label, current);
    });
    const colors = ["hsl(262 83% 58%)", "hsl(0 84% 60%)", "hsl(45 93% 47%)", "hsl(199 89% 48%)"];
    return Array.from(themeMap.entries()).map(([name, data], i) => ({
      name,
      records: data.count,
      totalValue: data.value,
      color: colors[i % colors.length],
    }));
  }, [filteredValues, metrics, language]);

  // ─── Chart 4: Cumulative Incidents Over Months ───
  const cumulativeData = useMemo(() => {
    let cumGov = 0;
    let cumCorrupt = 0;
    return chartPeriods.map(period => {
      const pv = getPeriodValues(period.period_id);
      const govVal = pv.filter(v => v.metric_id === METRIC.GOVERNANCE_INCIDENTS).reduce((s, v) => s + v.value, 0);
      const corruptVal = pv.filter(v => v.metric_id === METRIC.CORRUPTION_INCIDENTS).reduce((s, v) => s + v.value, 0);
      cumGov += govVal;
      cumCorrupt += corruptVal;
      return {
        name: periodLabel(period),
        govCumulative: cumGov,
        corruptCumulative: cumCorrupt,
        totalCumulative: cumGov + cumCorrupt,
      };
    });
  }, [chartPeriods, getPeriodValues, periodLabel]);

  // ─── Chart 5: YoY Comparison Bar ───
  const yoyComparisonData = useMemo(() => {
    const metricDefs = [
      { id: METRIC.GOVERNANCE_INCIDENTS, label: language === "th" ? "เหตุการณ์กำกับดูแล" : "Gov. Incidents" },
      { id: METRIC.CORRUPTION_INCIDENTS, label: language === "th" ? "เหตุการณ์ทุจริต" : "Corruption" },
      { id: METRIC.EMERGING_RISK, label: language === "th" ? "ความเสี่ยงเกิดใหม่" : "Emerging Risk" },
      { id: METRIC.TAX_TRAINING, label: language === "th" ? "อบรมภาษี" : "Tax Training" },
    ];

    return metricDefs.map(def => ({
      name: def.label,
      current: sumByMetric(filteredValues, def.id),
      previous: sumByMetric(prevYearValues, def.id),
    })).filter(d => d.current > 0 || d.previous > 0);
  }, [filteredValues, prevYearValues, language]);

  // ─── Chart 6: Radar - Governance Maturity ───
  const radarData = useMemo(() => {
    const defs = [
      { id: METRIC.GOVERNANCE_INCIDENTS, label: language === "th" ? "กำกับดูแล" : "Governance", fullMark: 10 },
      { id: METRIC.CORRUPTION_INCIDENTS, label: language === "th" ? "ต้านทุจริต" : "Anti-Corruption", fullMark: 10 },
      { id: METRIC.EMERGING_RISK, label: language === "th" ? "ความเสี่ยง" : "Risk Mgmt", fullMark: 100 },
      { id: METRIC.TAX_TRAINING, label: language === "th" ? "ภาษี" : "Tax Strategy", fullMark: 100 },
    ];
    return defs.map(d => ({
      subject: d.label,
      value: sumByMetric(filteredValues, d.id),
      fullMark: d.fullMark,
    }));
  }, [filteredValues, language]);

  const hasRadarData = radarData.some(d => d.value > 0);

  // ─── Years with data (for multi-year table) ───
  const yearsWithData = useMemo(() => {
    const yearSet = new Set<number>();
    metricValues.forEach(v => {
      const p = periods.find(pp => pp.period_id === v.period_id);
      if (p) yearSet.add(p.year);
    });
    return [...yearSet].sort((a, b) => b - a);
  }, [metricValues, periods]);

  // ─── Summary Table ───
  const summaryTableData = useMemo(() => {
    const metricDefs = [
      { id: METRIC.GOVERNANCE_INCIDENTS, context: "negative" as const },
      { id: METRIC.CORRUPTION_INCIDENTS, context: "negative" as const },
      { id: METRIC.EMERGING_RISK, context: "positive" as const },
      { id: METRIC.TAX_TRAINING, context: "positive" as const },
    ];

    if (isAllTime) {
      return metricDefs.map(def => {
        const metricInfo = metrics.find(m => m.metric_id === def.id);
        if (!metricInfo) return null;
        const yearData: Record<number, number> = {};
        filteredValues.forEach(v => {
          if (v.metric_id !== def.id) return;
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

        return {
          metricName: metricInfo.metric_name,
          unit: metricInfo.unit || "-",
          yearData,
          changePercent,
          context: def.context,
        };
      }).filter(Boolean);
    }

    return metricDefs.map(def => {
      const metricInfo = metrics.find(m => m.metric_id === def.id);
      if (!metricInfo) return null;
      const currentVal = sumByMetric(filteredValues, def.id);
      const prevVal = sumByMetric(prevYearValues, def.id);
      const hasMetricData = filteredValues.some(v => v.metric_id === def.id);
      
      let changePercent: number | null = null;
      if (prevVal > 0) changePercent = ((currentVal - prevVal) / prevVal) * 100;
      else if (currentVal > 0) changePercent = 100;
      else if (prevYearValues.some(v => v.metric_id === def.id)) changePercent = 0;

      const yearData: Record<number, number> = { [selectedYear]: currentVal };
      if (prevYear) yearData[prevYear] = prevVal;

      return {
        metricName: metricInfo.metric_name,
        unit: metricInfo.unit || "-",
        yearData,
        changePercent,
        context: def.context,
      };
    }).filter(Boolean);
  }, [filteredValues, prevYearValues, metrics, isAllTime, periods, yearsWithData, selectedYear, prevYear]);

  const tableYears = useMemo(() => isAllTime ? yearsWithData : (prevYear ? [selectedYear, prevYear] : [selectedYear]), [isAllTime, yearsWithData, selectedYear, prevYear]);

  if (loading) {
    return <ReportsLoadingSkeleton />;
  }

  return (
    <div ref={containerRef} className="space-y-6 pb-8 bg-gradient-to-br from-background via-background to-primary/5 min-h-screen -m-6 p-6">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Gradient Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-purple-600 to-violet-500 rounded-full" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            {language === "th" ? "Governance Dashboard" : "Governance Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th"
              ? "ตัวชี้วัดด้านธรรมาภิบาลและการกำกับดูแลกิจการ"
              : "Governance metrics and corporate oversight"}
          </p>
          {hasData && (
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {filteredValues.length.toLocaleString()} {language === "th" ? "รายการ" : "records"}
              </Badge>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                {language === "th" ? `ปี ${selectedYear}` : `Year ${selectedYear}`}
              </Badge>
            </div>
          )}
        </div>
        <ExportExcelButton
          data={(summaryTableData.filter(Boolean) as any[]).map(row => {
            const exportRow: Record<string, unknown> = {
              [language === "th" ? "ตัวชี้วัด" : "Metric"]: row.metricName,
              [language === "th" ? "หน่วย" : "Unit"]: row.unit,
            };
            tableYears.forEach(y => { exportRow[language === "th" ? `ค่าปี ${y}` : `Value ${y}`] = row.yearData[y] ?? "-"; });
            if (tableYears.length >= 2) {
              exportRow[language === "th" ? "เปลี่ยนแปลง (%)" : "Change (%)"] = row.changePercent !== null ? `${row.changePercent >= 0 ? "+" : ""}${row.changePercent.toFixed(1)}%` : "-";
            }
            return exportRow;
          })}
          filenamePrefix="governance_report"
          sourcePage="Governance Dashboard"
          appliedFilters={{
            company: filterCompany ? companies.find(c => c.company_id === filterCompany)?.company_name || filterCompany : "All",
            site: filterSite ? sites.find(s => s.site_id === filterSite)?.site_name || filterSite : "All",
            year: isAllTime ? "All Time" : String(selectedYear),
          }}
        />
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GovKPICard
          title={language === "th" ? "เหตุการณ์ด้านการกำกับดูแล" : "Governance Incidents"}
          value={hasGovIncidentData ? totalGovIncidents : null}
          unit={language === "th" ? "เรื่อง" : "cases"}
          icon={Shield}
          trend={govIncidentYoY.trend}
          trendValue={govIncidentYoY.value}
          trendContext="negative"
          sparklineData={getMonthlySparkline(METRIC.GOVERNANCE_INCIDENTS)}
          color="hsl(262 83% 58%)"
        />
        <GovKPICard
          title={language === "th" ? "เหตุการณ์ทุจริต/คอรัปชั่น" : "Corruption Incidents"}
          value={hasCorruptionData ? totalCorruptionIncidents : null}
          unit={language === "th" ? "ข้อ" : "cases"}
          icon={Gavel}
          trend={corruptionYoY.trend}
          trendValue={corruptionYoY.value}
          trendContext="negative"
          sparklineData={getMonthlySparkline(METRIC.CORRUPTION_INCIDENTS)}
          color="hsl(0 84% 60%)"
        />
        <GovKPICard
          title={language === "th" ? "การประเมินความเสี่ยงเกิดใหม่" : "Emerging Risk Assessments"}
          value={hasEmergingRiskData ? totalEmergingRisk : null}
          unit={language === "th" ? "เรื่อง" : "items"}
          icon={AlertTriangle}
          trend={emergingRiskYoY.trend}
          trendValue={emergingRiskYoY.value}
          trendContext="positive"
          sparklineData={getMonthlySparkline(METRIC.EMERGING_RISK)}
          color="hsl(45 93% 47%)"
        />
        <GovKPICard
          title={language === "th" ? "อบรมการบริหารภาษี" : "Tax Training"}
          value={hasTaxTrainingData ? totalTaxTraining : null}
          unit={language === "th" ? "คน" : "people"}
          icon={GraduationCap}
          trend={taxTrainingYoY.trend}
          trendValue={taxTrainingYoY.value}
          trendContext="positive"
          sparklineData={getMonthlySparkline(METRIC.TAX_TRAINING)}
          color="hsl(199 89% 48%)"
        />
      </div>

      {/* Zero Incidents Highlight Banner */}
      {hasData && totalIncidents === 0 && (hasGovIncidentData || hasCorruptionData) && (
        <Card className="bg-emerald-500/10 border-emerald-500/20 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <FileCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                {language === "th" ? "ไม่พบเหตุการณ์ด้านธรรมาภิบาล" : "Zero Governance Incidents"}
              </p>
              <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                {language === "th"
                  ? `ในปี ${selectedYear} ไม่มีเหตุการณ์ด้านการกำกับดูแลและทุจริตที่รายงาน — ผลลัพธ์ที่ดีเยี่ยม`
                  : `In ${selectedYear}, no governance or corruption incidents were reported — excellent result`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Incident Trend */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "แนวโน้มเหตุการณ์รายเดือน" : "Monthly Incident Trend"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyIncidentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={glassTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="governance" name={language === "th" ? "กำกับดูแล" : "Governance"} fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="corruption" name={language === "th" ? "ทุจริต" : "Corruption"} fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="total" name={language === "th" ? "รวม" : "Total"} stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Incidents by Site */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "เหตุการณ์แยกตามสถานที่" : "Incidents by Site"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incidentsBySite.length === 0 ? (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={incidentsBySite} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={glassTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="governance" name={language === "th" ? "กำกับดูแล" : "Governance"} stackId="a" fill="hsl(262 83% 58%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="corruption" name={language === "th" ? "ทุจริต" : "Corruption"} stackId="a" fill="hsl(0 84% 60%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Theme Distribution (Pie) */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "สัดส่วนข้อมูลตาม Theme" : "Data Distribution by Theme"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {themeDistribution.length === 0 ? (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
            ) : (
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={themeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="records"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {themeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={glassTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Cumulative Incidents */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "เหตุการณ์สะสมรายเดือน" : "Cumulative Incidents"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={glassTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="govCumulative" name={language === "th" ? "กำกับดูแล (สะสม)" : "Governance (Cum.)"} stroke="hsl(262 83% 58%)" fill="hsl(262 83% 58%)" fillOpacity={0.2} strokeWidth={2} />
                  <Area type="monotone" dataKey="corruptCumulative" name={language === "th" ? "ทุจริต (สะสม)" : "Corruption (Cum.)"} stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60%)" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 5: YoY Comparison */}
        {yoyComparisonData.length > 0 && (
          <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base font-medium">
                {language === "th" ? `เปรียบเทียบ ${prevYear} vs ${selectedYear}` : `${prevYear} vs ${selectedYear} Comparison`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yoyComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={glassTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="previous" name={`${prevYear}`} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.6} />
                  <Bar dataKey="current" name={`${selectedYear}`} fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Chart 6: Governance Radar */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "ภาพรวมธรรมาภิบาล" : "Governance Overview"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasRadarData ? (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูลเพียงพอ" : "Insufficient data"} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Radar
                    name={language === "th" ? "ค่าตัวชี้วัด" : "Metric Value"}
                    dataKey="value"
                    stroke="hsl(262 83% 58%)"
                    fill="hsl(262 83% 58%)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
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
            <FileCheck className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base font-medium">
            {language === "th" ? "สรุปตัวชี้วัดธรรมาภิบาล" : "Governance Metrics Summary"}
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
                  <TableHead className="min-w-[200px]">{language === "th" ? "ตัวชี้วัด" : "Metric"}</TableHead>
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
                {summaryTableData.map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium text-sm">{row.metricName}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{row.unit}</TableCell>
                    {tableYears.map((y, i) => (
                      <TableCell key={y} className={`text-right ${i === 0 ? "font-semibold" : "text-muted-foreground"}`}>
                        {(row.yearData[y] || 0) > 0 ? row.yearData[y].toLocaleString() : row.yearData[y] === 0 ? "0" : "-"}
                      </TableCell>
                    ))}
                    {tableYears.length >= 2 && (
                      <TableCell className="text-right">
                        {row.changePercent !== null ? (
                          <Badge
                            variant="outline"
                            className={
                              row.changePercent === 0
                                ? "bg-muted text-muted-foreground"
                                : row.context === "negative"
                                  ? row.changePercent <= 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                                  : row.changePercent >= 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {row.changePercent >= 0 ? "+" : ""}{row.changePercent.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {summaryTableData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={tableYears.length + 3} className="text-center text-muted-foreground py-8">
                      {language === "th" ? "ยังไม่มีข้อมูล" : "No data available"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
