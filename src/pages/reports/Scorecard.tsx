import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  CheckCircle,
  Target,
  Leaf,
  Users,
  Shield,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh";
import { ReportsLoadingSkeleton } from "@/components/ui/loading-skeleton";

interface Company {
  company_id: string;
  company_name: string;
}

interface Site {
  site_id: string;
  site_name: string;
  company_id: string;
}

interface ReportingPeriod {
  period_id: string;
  year: number;
  month: number;
  month_name: string;
}

interface EsgDimension {
  dimension_id: string;
  dimension_name: string;
}

interface MetricValue {
  value_id: string;
  metric_id: string;
  site_id: string;
  period_id: string;
  value: number;
  status: string;
}

interface EsgMetric {
  metric_id: string;
  metric_name: string;
  theme_id: string;
  unit: string | null;
}

interface EsgTheme {
  theme_id: string;
  theme_name: string;
  dimension_id: string;
}

// Gauge Chart Component
const GaugeChart = ({
  value,
  maxValue = 100,
  size = 200,
  strokeWidth = 20,
  label,
  showZones = false,
  color,
}: {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showZones?: boolean;
  color?: string;
}) => {
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);

  // Determine color based on value zones
  const getZoneColor = () => {
    if (color) return color;
    if (value < 40) return "hsl(var(--destructive))";
    if (value < 70) return "hsl(45 93% 47%)"; // Yellow/amber
    return "hsl(var(--primary))";
  };

  const gaugeColor = getZoneColor();

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background track */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Zone colors for main gauge */}
        {showZones && (
          <>
            {/* Red zone: 0-40% */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${
                strokeWidth / 2 + radius * (1 - Math.cos(Math.PI * 0.4))
              } ${size / 2 - radius * Math.sin(Math.PI * 0.4)}`}
              fill="none"
              stroke="hsl(var(--destructive) / 0.2)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Yellow zone: 40-70% */}
            <path
              d={`M ${strokeWidth / 2 + radius * (1 - Math.cos(Math.PI * 0.4))} ${
                size / 2 - radius * Math.sin(Math.PI * 0.4)
              } A ${radius} ${radius} 0 0 1 ${
                strokeWidth / 2 + radius * (1 - Math.cos(Math.PI * 0.7))
              } ${size / 2 - radius * Math.sin(Math.PI * 0.7)}`}
              fill="none"
              stroke="hsl(45 93% 47% / 0.2)"
              strokeWidth={strokeWidth}
            />
            {/* Green zone: 70-100% */}
            <path
              d={`M ${strokeWidth / 2 + radius * (1 - Math.cos(Math.PI * 0.7))} ${
                size / 2 - radius * Math.sin(Math.PI * 0.7)
              } A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="none"
              stroke="hsl(var(--primary) / 0.2)"
              strokeWidth={strokeWidth}
            />
          </>
        )}

        {/* Filled arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={gaugeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>

      {/* Center value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: size * 0.15 }}>
        <span className="text-3xl sm:text-4xl font-bold" style={{ color: gaugeColor }}>
          {Math.round(value)}
        </span>
        {label && <span className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</span>}
      </div>
    </div>
  );
};

// Mini Gauge for E, S, G scores
const MiniGauge = ({
  value,
  label,
  icon: Icon,
  color,
}: {
  value: number;
  label: string;
  icon: React.ElementType;
  color: string;
}) => {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="p-4 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <GaugeChart value={value} size={120} strokeWidth={12} color={color} />
      </CardContent>
    </Card>
  );
};

// KPI Card Component
const KPICard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}) => {
  return (
    <Card className="flex-1 min-w-[200px]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground">{title}</p>
            <p className="text-xl sm:text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            {trend && trendValue && (
              <div
                className={`flex items-center gap-0.5 text-xs ${
                  trend === "up" ? "text-emerald-600" : trend === "down" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {trend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trend === "down" ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Scorecard() {
  const { language } = useLanguage();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [dimensions, setDimensions] = useState<EsgDimension[]>([]);
  const [themes, setThemes] = useState<EsgTheme[]>([]);
  const [metrics, setMetrics] = useState<EsgMetric[]>([]);
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterQuarter, setFilterQuarter] = useState<string>("");

  const handleRefresh = useCallback(async () => {
    await fetchData();
  }, []);

  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: companiesData },
        { data: sitesData },
        { data: periodsData },
        { data: dimensionsData },
        { data: themesData },
        { data: metricsData },
        { data: valuesData },
      ] = await Promise.all([
        supabase.from("company").select("*").order("company_name"),
        supabase.from("site").select("*").order("site_name"),
        supabase.from("reporting_period").select("*").order("year", { ascending: false }),
        supabase.from("esg_dimension").select("*").order("dimension_name"),
        supabase.from("esg_theme").select("*").order("theme_name"),
        supabase.from("esg_metric").select("*").order("metric_name"),
        supabase.from("metric_value").select("*"),
      ]);

      setCompanies(companiesData || []);
      setSites(sitesData || []);
      setPeriods(periodsData || []);
      setDimensions(dimensionsData || []);
      setThemes(themesData || []);
      setMetrics(metricsData || []);
      setMetricValues(valuesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique years
  const uniqueYears = [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a);

  // Get quarter months
  const getQuarterMonths = (quarter: string) => {
    switch (quarter) {
      case "Q1":
        return [1, 2, 3];
      case "Q2":
        return [4, 5, 6];
      case "Q3":
        return [7, 8, 9];
      case "Q4":
        return [10, 11, 12];
      default:
        return [];
    }
  };

  // Filter sites by company
  const filteredSites = filterCompany ? sites.filter((s) => s.company_id === filterCompany) : sites;

  // Filter values
  const filteredValues = metricValues.filter((v) => {
    if (filterCompany) {
      const site = sites.find((s) => s.site_id === v.site_id);
      if (site?.company_id !== filterCompany) return false;
    }
    if (filterSite) {
      if (v.site_id !== filterSite) return false;
    }
    if (filterYear) {
      const period = periods.find((p) => p.period_id === v.period_id);
      if (period?.year !== parseInt(filterYear)) return false;
    }
    if (filterQuarter) {
      const period = periods.find((p) => p.period_id === v.period_id);
      const quarterMonths = getQuarterMonths(filterQuarter);
      if (!period || !quarterMonths.includes(period.month)) return false;
    }
    return true;
  });

  // Calculate scores
  const totalRecords = filteredValues.length;
  const submittedCount = filteredValues.filter((v) => v.status === "submitted").length;
  const completionRate = totalRecords > 0 ? Math.round((submittedCount / totalRecords) * 100) : 0;

  // Dimension scores
  const getDimensionScore = (dimensionName: string) => {
    const dim = dimensions.find((d) => {
      const name = d.dimension_name.toLowerCase();
      return (
        name.includes(dimensionName.toLowerCase()) ||
        (dimensionName === "environment" && name.includes("สิ่งแวดล้อม")) ||
        (dimensionName === "social" && name.includes("สังคม")) ||
        (dimensionName === "governance" && name.includes("ธรรมาภิบาล"))
      );
    });

    if (!dim) return 0;

    const dimThemes = themes.filter((t) => t.dimension_id === dim.dimension_id);
    const dimMetrics = metrics.filter((m) => dimThemes.some((t) => t.theme_id === m.theme_id));
    const dimValues = filteredValues.filter((v) => dimMetrics.some((m) => m.metric_id === v.metric_id));

    const submitted = dimValues.filter((v) => v.status === "submitted").length;
    return dimValues.length > 0 ? Math.round((submitted / dimValues.length) * 100) : 0;
  };

  const environmentScore = getDimensionScore("environment");
  const socialScore = getDimensionScore("social");
  const governanceScore = getDimensionScore("governance");

  // Overall ESG score (weighted average)
  const overallScore =
    environmentScore && socialScore && governanceScore
      ? Math.round((environmentScore + socialScore + governanceScore) / 3)
      : completionRate;

  // Theme performance for radar chart and best/worst
  const themePerformance = themes
    .map((theme) => {
      const themeMetrics = metrics.filter((m) => m.theme_id === theme.theme_id);
      const themeValues = filteredValues.filter((v) => themeMetrics.some((m) => m.metric_id === v.metric_id));
      const submitted = themeValues.filter((v) => v.status === "submitted").length;
      const score = themeValues.length > 0 ? Math.round((submitted / themeValues.length) * 100) : 0;

      return {
        theme_id: theme.theme_id,
        name: theme.theme_name,
        score,
        recordCount: themeValues.length,
        fullMark: 100,
      };
    })
    .filter((t) => t.recordCount > 0)
    .sort((a, b) => b.score - a.score);

  // Get best and worst performing themes
  const bestTheme = themePerformance[0];
  const worstTheme = themePerformance[themePerformance.length - 1];

  // Prepare radar chart data (top 8 themes)
  const radarData = themePerformance.slice(0, 8).map((t) => ({
    subject: t.name.length > 15 ? t.name.substring(0, 15) + "..." : t.name,
    current: t.score,
    target: 80, // Target score
    fullMark: 100,
  }));

  // Data completeness
  const dataCompleteness = completionRate;

  // Calculate trend (comparing with previous period)
  const getTrend = () => {
    // Simple mock trend for now
    const randomTrend = Math.random();
    if (randomTrend > 0.6) return { direction: "up" as const, value: "+5%" };
    if (randomTrend < 0.4) return { direction: "down" as const, value: "-3%" };
    return { direction: "neutral" as const, value: "0%" };
  };

  const scoreTrend = getTrend();

  if (loading) {
    return <ReportsLoadingSkeleton />;
  }

  return (
    <div ref={containerRef} className="space-y-6 pb-8">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {language === "th" ? "ESG Scorecard" : "ESG Scorecard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th"
              ? "ภาพรวมคะแนนความยั่งยืนขององค์กร"
              : "Organization sustainability performance overview"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "บริษัท" : "Company"}</Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.company_id} value={c.company_id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "สถานที่" : "Site"}</Label>
              <Select value={filterSite} onValueChange={setFilterSite}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {filteredSites.map((s) => (
                    <SelectItem key={s.site_id} value={s.site_id}>
                      {s.site_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "ปี" : "Year"}</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {uniqueYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "ไตรมาส" : "Quarter"}</Label>
              <Select value={filterQuarter} onValueChange={setFilterQuarter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
                  <SelectItem value="Q2">Q2 (Apr-Jun)</SelectItem>
                  <SelectItem value="Q3">Q3 (Jul-Sep)</SelectItem>
                  <SelectItem value="Q4">Q4 (Oct-Dec)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Gauge and Mini Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall ESG Score */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-center">
              {language === "th" ? "คะแนน ESG รวม" : "Overall ESG Score"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <GaugeChart
              value={overallScore}
              size={240}
              strokeWidth={24}
              showZones={true}
              label={language === "th" ? "คะแนน" : "Score"}
            />
          </CardContent>
        </Card>

        {/* E, S, G Mini Gauges */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {language === "th" ? "คะแนนตามมิติ" : "Dimension Scores"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 justify-center">
              <MiniGauge
                value={environmentScore}
                label={language === "th" ? "สิ่งแวดล้อม" : "Environment"}
                icon={Leaf}
                color="hsl(142 71% 45%)"
              />
              <MiniGauge
                value={socialScore}
                label={language === "th" ? "สังคม" : "Social"}
                icon={Users}
                color="hsl(199 89% 48%)"
              />
              <MiniGauge
                value={governanceScore}
                label={language === "th" ? "ธรรมาภิบาล" : "Governance"}
                icon={Shield}
                color="hsl(280 65% 60%)"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={language === "th" ? "คะแนนรวม" : "Overall Score"}
          value={overallScore}
          subtitle={language === "th" ? "จากเป้าหมาย 100" : "Target: 100"}
          icon={Target}
          trend={scoreTrend.direction}
          trendValue={scoreTrend.value}
        />
        <KPICard
          title={language === "th" ? "หัวข้อดีที่สุด" : "Best Theme"}
          value={bestTheme?.score || 0}
          subtitle={bestTheme?.name || "-"}
          icon={Award}
          trend="up"
          trendValue={`${bestTheme?.score || 0}%`}
        />
        <KPICard
          title={language === "th" ? "ต้องปรับปรุง" : "Needs Improvement"}
          value={worstTheme?.score || 0}
          subtitle={worstTheme?.name || "-"}
          icon={AlertTriangle}
          trend="down"
          trendValue={`${worstTheme?.score || 0}%`}
        />
        <KPICard
          title={language === "th" ? "ข้อมูลครบถ้วน" : "Data Completeness"}
          value={`${dataCompleteness}%`}
          subtitle={`${submittedCount}/${totalRecords} ${language === "th" ? "รายการ" : "records"}`}
          icon={CheckCircle}
        />
      </div>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {language === "th" ? "ประสิทธิภาพตามหัวข้อ ESG" : "ESG Theme Performance"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <Radar
                  name={language === "th" ? "เป้าหมาย" : "Target"}
                  dataKey="target"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.1}
                  strokeDasharray="5 5"
                />
                <Radar
                  name={language === "th" ? "ปัจจุบัน" : "Current"}
                  dataKey="current"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              {language === "th" ? "ไม่มีข้อมูล" : "No data available"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
