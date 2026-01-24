import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart3,
  TrendingUp,
  Building2,
  MapPin,
  Activity,
  FileText,
  Leaf,
  Users,
  Shield,
  Calendar,
  Globe,
  CheckCircle2,
  Clock,
  Target,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useReportSections } from "@/contexts/ReportSectionsContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh";
import { ReportsLoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { TrendAnalytics } from "@/components/reports/TrendAnalytics";

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

// Dimension icons mapping
const getDimensionIcon = (dimensionName: string) => {
  const name = dimensionName.toLowerCase();
  if (name.includes("environment") || name.includes("สิ่งแวดล้อม")) return Leaf;
  if (name.includes("social") || name.includes("สังคม")) return Users;
  if (name.includes("governance") || name.includes("ธรรมาภิบาล")) return Shield;
  return Globe;
};

// Dimension colors
const getDimensionColor = (dimensionName: string) => {
  const name = dimensionName.toLowerCase();
  if (name.includes("environment") || name.includes("สิ่งแวดล้อม")) return "hsl(var(--chart-1))";
  if (name.includes("social") || name.includes("สังคม")) return "hsl(var(--chart-2))";
  if (name.includes("governance") || name.includes("ธรรมาภิบาล")) return "hsl(var(--chart-4))";
  return "hsl(var(--chart-5))";
};

const getDimensionBgColor = (dimensionName: string) => {
  const name = dimensionName.toLowerCase();
  if (name.includes("environment") || name.includes("สิ่งแวดล้อม")) return "bg-emerald-500/10";
  if (name.includes("social") || name.includes("สังคม")) return "bg-cyan-500/10";
  if (name.includes("governance") || name.includes("ธรรมาภิบาล")) return "bg-amber-500/10";
  return "bg-blue-500/10";
};

export default function Reports() {
  const { language } = useLanguage();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [dimensions, setDimensions] = useState<EsgDimension[]>([]);
  const [themes, setThemes] = useState<EsgTheme[]>([]);
  const [metrics, setMetrics] = useState<EsgMetric[]>([]);
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filters
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");

  // Drill-down dialog state
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [drilldownDialogOpen, setDrilldownDialogOpen] = useState(false);

  // Interactive trend chart filters
  const [trendThemeFilter, setTrendThemeFilter] = useState<string>("__all__");
  const [trendMetricFilter, setTrendMetricFilter] = useState<string>("__all__");
  const [trendYearFilter, setTrendYearFilter] = useState<string>("__all__");
  const [trendMonthFilter, setTrendMonthFilter] = useState<string>("__all__");

  // Report sections visibility
  const { isSectionVisible } = useReportSections();

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
      // Fetch all metric values using pagination to get ALL records (same as DataEntry)
      const fetchAllMetricValues = async (): Promise<MetricValue[]> => {
        const PAGE_SIZE = 1000;
        let allValues: MetricValue[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('metric_value')
            .select('*')
            .order('updated_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allValues = [...allValues, ...data];
            from += PAGE_SIZE;
            hasMore = data.length === PAGE_SIZE;
          } else {
            hasMore = false;
          }
        }

        return allValues;
      };

      const [
        { data: companiesData },
        { data: sitesData },
        { data: periodsData },
        { data: dimensionsData },
        { data: themesData },
        { data: metricsData },
        valuesData,
      ] = await Promise.all([
        supabase.from("company").select("*").order("company_name"),
        supabase.from("site").select("*").order("site_name"),
        supabase.from("reporting_period").select("*").order("year", { ascending: false }),
        supabase.from("esg_dimension").select("*").order("dimension_name"),
        supabase.from("esg_theme").select("*").order("theme_name"),
        supabase.from("esg_metric").select("*").order("metric_name"),
        fetchAllMetricValues(),
      ]);

      setCompanies(companiesData || []);
      setSites(sitesData || []);
      setPeriods(periodsData || []);
      setDimensions(dimensionsData || []);
      setThemes(themesData || []);
      setMetrics(metricsData || []);
      setMetricValues(valuesData);
      setLastRefresh(new Date());
      
      console.log(`[Reports] Loaded ${valuesData.length} metric values`);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique years
  const uniqueYears = [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a);

  // Get unique months for selected year
  const uniqueMonths = filterYear
    ? periods.filter((p) => p.year === parseInt(filterYear)).sort((a, b) => a.month - b.month)
    : [];

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
    if (filterMonth) {
      const period = periods.find((p) => p.period_id === v.period_id);
      if (period?.month !== parseInt(filterMonth)) return false;
    }
    return true;
  });

  // Calculate summary stats
  const totalRecords = filteredValues.length;
  const draftCount = filteredValues.filter((v) => v.status === "draft").length;
  const submittedCount = filteredValues.filter((v) => v.status === "submitted").length;
  const completionRate = totalRecords > 0 ? Math.round((submittedCount / totalRecords) * 100) : 0;

  // Data by dimension with enhanced metrics
  const dimensionData = dimensions.map((dim) => {
    const dimThemes = themes.filter((t) => t.dimension_id === dim.dimension_id);
    const dimMetrics = metrics.filter((m) => dimThemes.some((t) => t.theme_id === m.theme_id));
    const dimValues = filteredValues.filter((v) => dimMetrics.some((m) => m.metric_id === v.metric_id));

    const submitted = dimValues.filter((v) => v.status === "submitted").length;
    const total = dimValues.length;
    const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;

    return {
      dimension_id: dim.dimension_id,
      name: dim.dimension_name,
      total: dimValues.length,
      submitted,
      draft: dimValues.filter((v) => v.status === "draft").length,
      rate,
      themeCount: dimThemes.length,
      metricCount: dimMetrics.length,
      totalValue: dimValues.reduce((sum, v) => sum + v.value, 0),
      avgValue: dimValues.length > 0 ? dimValues.reduce((sum, v) => sum + v.value, 0) / dimValues.length : 0,
    };
  });

  // Data by status for pie chart
  const statusData = [
    {
      name: language === "th" ? "ร่าง" : "Draft",
      value: draftCount,
      color: "hsl(var(--muted-foreground))",
    },
    {
      name: language === "th" ? "ส่งแล้ว" : "Submitted",
      value: submittedCount,
      color: "hsl(var(--primary))",
    },
  ].filter((d) => d.value > 0);

  // Data by month for the selected year
  const selectedYear = filterYear ? parseInt(filterYear) : uniqueYears[0];
  const monthlyData = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month)
    .map((period) => {
      const monthValues = filteredValues.filter((v) => v.period_id === period.period_id);
      return {
        name: period.month_name.slice(0, 3),
        month: period.month,
        submitted: monthValues.filter((v) => v.status === "submitted").length,
        draft: monthValues.filter((v) => v.status === "draft").length,
        total: monthValues.length,
      };
    });

  // Theme data with hierarchy
  const themeData = themes.map((theme) => {
    const themeMetrics = metrics.filter((m) => m.theme_id === theme.theme_id);
    const themeValues = filteredValues.filter((v) => themeMetrics.some((m) => m.metric_id === v.metric_id));
    const dimension = dimensions.find((d) => d.dimension_id === theme.dimension_id);

    return {
      theme_id: theme.theme_id,
      name: theme.theme_name,
      dimension_id: theme.dimension_id,
      dimensionName: dimension?.dimension_name || "",
      metricCount: themeMetrics.length,
      recordCount: themeValues.length,
      submittedCount: themeValues.filter((v) => v.status === "submitted").length,
      completionRate: themeValues.length > 0
        ? Math.round((themeValues.filter((v) => v.status === "submitted").length / themeValues.length) * 100)
        : 0,
    };
  }).filter(t => t.recordCount > 0).sort((a, b) => b.recordCount - a.recordCount);

  // Top metrics by value count
  const topMetrics = metrics
    .map((metric) => {
      const metricVals = filteredValues.filter((v) => v.metric_id === metric.metric_id);
      const theme = themes.find((t) => t.theme_id === metric.theme_id);
      const dimension = dimensions.find((d) => d.dimension_id === theme?.dimension_id);
      return {
        metric_id: metric.metric_id,
        name: metric.metric_name,
        unit: metric.unit,
        theme: theme?.theme_name || "",
        dimension: dimension?.dimension_name || "",
        count: metricVals.length,
        totalValue: metricVals.reduce((sum, v) => sum + v.value, 0),
        avgValue: metricVals.length > 0 
          ? metricVals.reduce((sum, v) => sum + v.value, 0) / metricVals.length 
          : 0,
        submittedCount: metricVals.filter((v) => v.status === "submitted").length,
      };
    })
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Site performance data
  const sitePerformance = filteredSites
    .map((site) => {
      const siteValues = filteredValues.filter((v) => v.site_id === site.site_id);
      const company = companies.find((c) => c.company_id === site.company_id);
      return {
        site_id: site.site_id,
        name: site.site_name,
        company: company?.company_name || "",
        submitted: siteValues.filter((v) => v.status === "submitted").length,
        draft: siteValues.filter((v) => v.status === "draft").length,
        total: siteValues.length,
        completionRate: siteValues.length > 0
          ? Math.round((siteValues.filter((v) => v.status === "submitted").length / siteValues.length) * 100)
          : 0,
      };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 6);

  // Radial chart data for overall ESG score
  const overallScore = completionRate;
  const radialData = [
    {
      name: "Score",
      value: overallScore,
      fill: "hsl(var(--primary))",
    },
  ];

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  // Theme trend data with monthly breakdown
  const getThemeTrendData = (themeId: string) => {
    const theme = themes.find((t) => t.theme_id === themeId);
    if (!theme) return [];

    const themeMetrics = metrics.filter((m) => m.theme_id === themeId);
    const themeMetricIds = themeMetrics.map((m) => m.metric_id);

    // Get data for selected year or all years
    const yearPeriods = selectedYear
      ? periods.filter((p) => p.year === selectedYear)
      : periods;

    const sortedPeriods = [...yearPeriods].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    return sortedPeriods.map((period) => {
      const periodValues = filteredValues.filter(
        (v) => v.period_id === period.period_id && themeMetricIds.includes(v.metric_id)
      );
      const totalValue = periodValues.reduce((sum, v) => sum + v.value, 0);
      
      return {
        name: `${period.month_name.slice(0, 3)} ${period.year}`,
        month: period.month,
        year: period.year,
        records: periodValues.length,
        totalValue: Math.round(totalValue * 100) / 100,
        avgValue: periodValues.length > 0 ? Math.round((totalValue / periodValues.length) * 100) / 100 : 0,
        submitted: periodValues.filter((v) => v.status === "submitted").length,
      };
    }).filter(d => d.records > 0);
  };

  // Get theme details for drilldown
  const getThemeDetails = (themeId: string) => {
    const theme = themes.find((t) => t.theme_id === themeId);
    if (!theme) return null;

    const dimension = dimensions.find((d) => d.dimension_id === theme.dimension_id);
    const themeMetrics = metrics.filter((m) => m.theme_id === themeId);
    const themeMetricIds = themeMetrics.map((m) => m.metric_id);
    const themeValues = filteredValues.filter((v) => themeMetricIds.includes(v.metric_id));

    // Metric breakdown
    const metricBreakdown = themeMetrics.map((metric) => {
      const metricVals = themeValues.filter((v) => v.metric_id === metric.metric_id);
      return {
        metric_id: metric.metric_id,
        name: metric.metric_name,
        unit: metric.unit,
        recordCount: metricVals.length,
        totalValue: metricVals.reduce((sum, v) => sum + v.value, 0),
        avgValue: metricVals.length > 0
          ? metricVals.reduce((sum, v) => sum + v.value, 0) / metricVals.length
          : 0,
        submittedCount: metricVals.filter((v) => v.status === "submitted").length,
      };
    }).filter(m => m.recordCount > 0).sort((a, b) => b.recordCount - a.recordCount);

    // Site breakdown
    const siteBreakdown = sites.map((site) => {
      const siteVals = themeValues.filter((v) => v.site_id === site.site_id);
      const company = companies.find((c) => c.company_id === site.company_id);
      return {
        site_id: site.site_id,
        name: site.site_name,
        company: company?.company_name || "",
        recordCount: siteVals.length,
        totalValue: siteVals.reduce((sum, v) => sum + v.value, 0),
        submittedCount: siteVals.filter((v) => v.status === "submitted").length,
      };
    }).filter(s => s.recordCount > 0).sort((a, b) => b.recordCount - a.recordCount);

    return {
      theme,
      dimension,
      metricBreakdown,
      siteBreakdown,
      totalRecords: themeValues.length,
      submittedRecords: themeValues.filter((v) => v.status === "submitted").length,
      trendData: getThemeTrendData(themeId),
    };
  };

  const selectedThemeDetails = selectedTheme ? getThemeDetails(selectedTheme) : null;

  // Top themes with trend data for cards
  const themesWithTrend = themeData.slice(0, 6).map((theme) => ({
    ...theme,
    trendData: getThemeTrendData(theme.theme_id),
  }));

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
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {language === "th" ? "Executive ESG Dashboard" : "Executive ESG Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {language === "th" 
              ? "ภาพรวมประสิทธิภาพความยั่งยืนขององค์กร" 
              : "Enterprise Sustainability Performance Overview"}
          </p>
        </div>
        
        {/* Last Refresh Indicator */}
        {lastRefresh && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {language === "th" ? "อัปเดตล่าสุด: " : "Last updated: "}
              {lastRefresh.toLocaleTimeString(language === "th" ? "th-TH" : "en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {language === "th" ? "บริษัท" : "Company"}
            </Label>
            <Select
              value={filterCompany || "__all__"}
              onValueChange={(v) => {
                setFilterCompany(v === "__all__" ? "" : v);
                setFilterSite("");
              }}
            >
              <SelectTrigger className="w-36 h-9">
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {language === "th" ? "สถานที่" : "Location"}
            </Label>
            <Select
              value={filterSite || "__all__"}
              onValueChange={(v) => setFilterSite(v === "__all__" ? "" : v)}
              disabled={!filterCompany}
            >
              <SelectTrigger className="w-36 h-9">
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {language === "th" ? "ปี" : "Year"}
            </Label>
            <Select
              value={filterYear || "__all__"}
              onValueChange={(v) => {
                setFilterYear(v === "__all__" ? "" : v);
                setFilterMonth("");
              }}
            >
              <SelectTrigger className="w-24 h-9">
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {language === "th" ? "เดือน" : "Month"}
            </Label>
            <Select
              value={filterMonth || "__all__"}
              onValueChange={(v) => setFilterMonth(v === "__all__" ? "" : v)}
              disabled={!filterYear}
            >
              <SelectTrigger className="w-28 h-9">
                <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                {uniqueMonths.map((p) => (
                  <SelectItem key={p.period_id} value={p.month.toString()}>
                    {p.month_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
      </div>
      {/* Executive Summary Row */}
      {isSectionVisible("summary") && (
      <div id="section-summary" className="grid grid-cols-1 lg:grid-cols-4 gap-4 scroll-mt-4">
        {/* Data Entry Success */}
        <Card className="lg:col-span-1 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {language === "th" ? "ลงข้อมูลสำเร็จ" : "Data Entry Success"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center relative">
              <ResponsiveContainer width={140} height={140}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="100%"
                  barSize={12}
                  data={radialData}
                  startAngle={180}
                  endAngle={-180}
                >
                  <RadialBar
                    background={{ fill: "hsl(var(--muted))" }}
                    dataKey="value"
                    cornerRadius={6}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-primary">{overallScore}%</span>
                <span className="text-[10px] text-muted-foreground">
                  {language === "th" ? "สำเร็จ" : "Complete"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {language === "th" ? "สถิติภาพรวม" : "Quick Statistics"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-muted-foreground">
                    {language === "th" ? "ข้อมูลทั้งหมด" : "Total Records"}
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{totalRecords}</p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                  <span className="text-xs text-muted-foreground">
                    {language === "th" ? "ส่งแล้ว" : "Submitted"}
                  </span>
                </div>
                <p className="text-2xl font-bold text-cyan-600">{submittedCount}</p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-muted-foreground">
                    {language === "th" ? "ร่าง" : "Draft"}
                  </span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{draftCount}</p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-muted-foreground">
                    {language === "th" ? "สถานที่" : "Sites"}
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-600">{filteredSites.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* ESG Dimensions Overview */}
      {isSectionVisible("dimensions") && (
      <Card id="section-dimensions" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {language === "th" ? "ภาพรวมมิติ ESG" : "ESG Dimensions Overview"}
          </CardTitle>
          <CardDescription>
            {language === "th" 
              ? "สรุปประสิทธิภาพตามมิติด้านสิ่งแวดล้อม สังคม และธรรมาภิบาล" 
              : "Performance summary by Environmental, Social, and Governance dimensions"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dimensionData.map((dim) => {
              const DimIcon = getDimensionIcon(dim.name);
              const color = getDimensionColor(dim.name);
              const bgClass = getDimensionBgColor(dim.name);
              
              return (
                <div
                  key={dim.dimension_id}
                  className={`p-5 rounded-xl border ${bgClass} transition-all hover:shadow-md`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2.5 rounded-lg"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <DimIcon className="h-5 w-5" style={{ color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{dim.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {dim.themeCount} {language === "th" ? "หัวข้อ" : "themes"} • {dim.metricCount} {language === "th" ? "ตัวชี้วัด" : "metrics"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold" style={{ color }}>{dim.rate}%</span>
                    </div>
                  </div>
                  
                  <Progress value={dim.rate} className="h-2 mb-3" />
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{dim.submitted} {language === "th" ? "ส่งแล้ว" : "submitted"}</span>
                    <span>{dim.total} {language === "th" ? "รายการ" : "records"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Interactive Trend Chart */}
      {isSectionVisible("trend") && (
      <Card id="section-trend" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {language === "th" ? "กราฟแนวโน้ม" : "Trend Chart"}
          </CardTitle>
          <CardDescription>
            {language === "th" 
              ? "เลือกหัวข้อ ตัวชี้วัด ปี และเดือน เพื่อดูแนวโน้มข้อมูล" 
              : "Select theme, metric, year, and month to view data trends"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Trend Chart Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {language === "th" ? "หัวข้อ" : "Theme"}
              </Label>
              <Select value={trendThemeFilter} onValueChange={(val) => {
                setTrendThemeFilter(val);
                setTrendMetricFilter("__all__"); // Reset metric when theme changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "th" ? "เลือกหัวข้อ" : "Select Theme"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {language === "th" ? "เลือกหัวข้อ" : "Select Theme"}
                  </SelectItem>
                  {themes.map((theme) => {
                    const dimension = dimensions.find((d) => d.dimension_id === theme.dimension_id);
                    return (
                      <SelectItem key={theme.theme_id} value={theme.theme_id}>
                        {theme.theme_name} ({dimension?.dimension_name})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {language === "th" ? "ตัวชี้วัด" : "Metric"}
              </Label>
              <Select 
                value={trendMetricFilter} 
                onValueChange={setTrendMetricFilter}
                disabled={trendThemeFilter === "__all__"}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All Metrics"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {language === "th" ? "ทั้งหมด" : "All Metrics"}
                  </SelectItem>
                  {metrics
                    .filter((m) => trendThemeFilter === "__all__" || m.theme_id === trendThemeFilter)
                    .map((metric) => (
                      <SelectItem key={metric.metric_id} value={metric.metric_id}>
                        {metric.metric_name} {metric.unit ? `(${metric.unit})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {language === "th" ? "ปี" : "Year"}
              </Label>
              <Select value={trendYearFilter} onValueChange={(val) => {
                setTrendYearFilter(val);
                setTrendMonthFilter("__all__"); // Reset month when year changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All Years"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {language === "th" ? "ทั้งหมด" : "All Years"}
                  </SelectItem>
                  {uniqueYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {language === "th" ? "เดือน" : "Month"}
              </Label>
              <Select 
                value={trendMonthFilter} 
                onValueChange={setTrendMonthFilter}
                disabled={trendYearFilter === "__all__"}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All Months"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {language === "th" ? "ทั้งหมด" : "All Months"}
                  </SelectItem>
                  {periods
                    .filter((p) => trendYearFilter === "__all__" || p.year === parseInt(trendYearFilter))
                    .sort((a, b) => a.month - b.month)
                    .map((period) => (
                      <SelectItem key={period.period_id} value={period.month.toString()}>
                        {period.month_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Trend Chart */}
          {(() => {
            // Show prompt when no theme is selected
            if (trendThemeFilter === "__all__") {
              return (
                <div className="h-72 flex flex-col items-center justify-center text-center gap-4 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
                  <div className="p-4 rounded-full bg-primary/10">
                    <TrendingUp className="h-10 w-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {language === "th" ? "เลือกหัวข้อที่ต้องการ" : "Select a Theme"}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {language === "th" 
                        ? "กรุณาเลือกหัวข้อ ESG จากตัวกรองด้านบนเพื่อดูกราฟแนวโน้มข้อมูล" 
                        : "Please select an ESG theme from the filter above to view the trend chart"}
                    </p>
                  </div>
                </div>
              );
            }

            // Filter periods
            let chartPeriods = [...periods];
            if (trendYearFilter !== "__all__") {
              chartPeriods = chartPeriods.filter((p) => p.year === parseInt(trendYearFilter));
            }
            if (trendMonthFilter !== "__all__") {
              chartPeriods = chartPeriods.filter((p) => p.month === parseInt(trendMonthFilter));
            }
            chartPeriods = chartPeriods.sort((a, b) => {
              if (a.year !== b.year) return a.year - b.year;
              return a.month - b.month;
            });

            // Get relevant metrics
            let relevantMetrics: typeof metrics = [];
            if (trendMetricFilter !== "__all__") {
              relevantMetrics = metrics.filter((m) => m.metric_id === trendMetricFilter);
            } else {
              relevantMetrics = metrics.filter((m) => m.theme_id === trendThemeFilter);
            }

            const showMultipleMetrics = trendMetricFilter === "__all__" && relevantMetrics.length > 1;

            const selectedThemeData = trendThemeFilter !== "__all__" 
              ? themes.find((t) => t.theme_id === trendThemeFilter)
              : null;

            const selectedMetricData = trendMetricFilter !== "__all__"
              ? metrics.find((m) => m.metric_id === trendMetricFilter)
              : null;

            const displayUnit = selectedMetricData?.unit || "";

            // Chart colors for multiple metrics
            const metricColors = [
              "hsl(var(--chart-1))",
              "hsl(var(--chart-2))",
              "hsl(var(--chart-3))",
              "hsl(var(--chart-4))",
              "hsl(var(--chart-5))",
              "hsl(var(--primary))",
            ];

            if (showMultipleMetrics) {
              // Multiple metrics mode - show separate line for each metric
              const multiMetricData = chartPeriods.map((period) => {
                const dataPoint: Record<string, string | number> = {
                  name: trendYearFilter !== "__all__" 
                    ? period.month_name.slice(0, 3) 
                    : `${period.month_name.slice(0, 3)} ${period.year}`,
                  period: `${period.month_name} ${period.year}`,
                };

                relevantMetrics.forEach((metric) => {
                  const metricValues = filteredValues.filter(
                    (v) => v.period_id === period.period_id && v.metric_id === metric.metric_id
                  );
                  const totalValue = metricValues.reduce((sum, v) => sum + v.value, 0);
                  dataPoint[metric.metric_id] = Math.round(totalValue * 100) / 100;
                });

                return dataPoint;
              }).filter((d) => {
                // Keep only periods that have at least one metric value
                return relevantMetrics.some((m) => (d[m.metric_id] as number) > 0);
              });

              const hasData = multiMetricData.length > 0;

              return hasData ? (
                <div className="space-y-4">
                  {selectedThemeData && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Badge variant="outline" className="bg-primary/10">
                        {selectedThemeData.theme_name}
                      </Badge>
                      <span>•</span>
                      <span>{relevantMetrics.length} {language === "th" ? "ตัวชี้วัด" : "metrics"}</span>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={multiMetricData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => {
                          const metric = relevantMetrics.find((m) => m.metric_id === name);
                          const metricName = metric?.metric_name || name;
                          const unit = metric?.unit || "";
                          return [`${value.toLocaleString()}${unit ? ` ${unit}` : ""}`, metricName];
                        }}
                      />
                      <Legend 
                        formatter={(value) => {
                          const metric = relevantMetrics.find((m) => m.metric_id === value);
                          return metric ? `${metric.metric_name}${metric.unit ? ` (${metric.unit})` : ""}` : value;
                        }}
                      />
                      {relevantMetrics.map((metric, index) => (
                        <Line
                          key={metric.metric_id}
                          type="monotone"
                          dataKey={metric.metric_id}
                          name={metric.metric_id}
                          stroke={metricColors[index % metricColors.length]}
                          strokeWidth={2}
                          dot={{ fill: metricColors[index % metricColors.length], strokeWidth: 2, r: 4 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Metric Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-4 border-t">
                    {relevantMetrics.map((metric, index) => {
                      const metricTotal = multiMetricData.reduce((sum, d) => sum + ((d[metric.metric_id] as number) || 0), 0);
                      return (
                        <div key={metric.metric_id} className="p-3 rounded-lg bg-muted/50 border">
                          <div className="flex items-center gap-2 mb-1">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: metricColors[index % metricColors.length] }}
                            />
                            <span className="text-xs text-muted-foreground truncate">{metric.metric_name}</span>
                          </div>
                          <p className="text-lg font-bold">
                            {metricTotal.toLocaleString()}
                            {metric.unit && <span className="text-xs font-normal ml-1">{metric.unit}</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-muted-foreground">
                  {language === "th" ? "ไม่มีข้อมูลสำหรับตัวกรองที่เลือก" : "No data for selected filters"}
                </div>
              );
            }

            // Single metric or aggregated mode
            const trendChartData = chartPeriods.map((period) => {
              const periodValues = filteredValues.filter(
                (v) => v.period_id === period.period_id && relevantMetrics.some((m) => m.metric_id === v.metric_id)
              );
              const totalValue = periodValues.reduce((sum, v) => sum + v.value, 0);
              
              return {
                name: trendYearFilter !== "__all__" 
                  ? period.month_name.slice(0, 3) 
                  : `${period.month_name.slice(0, 3)} ${period.year}`,
                period: `${period.month_name} ${period.year}`,
                month: period.month,
                year: period.year,
                records: periodValues.length,
                totalValue: Math.round(totalValue * 100) / 100,
                avgValue: periodValues.length > 0 ? Math.round((totalValue / periodValues.length) * 100) / 100 : 0,
                submitted: periodValues.filter((v) => v.status === "submitted").length,
              };
            }).filter((d) => d.records > 0);

            return trendChartData.length > 0 ? (
              <div className="space-y-4">
                {(selectedThemeData || selectedMetricData) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    {selectedThemeData && (
                      <Badge variant="outline" className="bg-primary/10">
                        {selectedThemeData.theme_name}
                      </Badge>
                    )}
                    {selectedMetricData && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700">
                        {selectedMetricData.metric_name}
                        {selectedMetricData.unit && ` (${selectedMetricData.unit})`}
                      </Badge>
                    )}
                    <span>•</span>
                    <span>{trendChartData.reduce((sum, d) => sum + d.records, 0)} {language === "th" ? "รายการ" : "records"}</span>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendChartData}>
                    <defs>
                      <linearGradient id="colorTrendValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTrendRecords" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => {
                        const formattedValue = typeof value === "number" ? value.toLocaleString() : value;
                        if (displayUnit && (name === (language === "th" ? "ค่ารวม" : "Total Value"))) {
                          return [`${formattedValue} ${displayUnit}`, name];
                        }
                        return [formattedValue, name];
                      }}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalValue"
                      name={language === "th" ? "ค่ารวม" : "Total Value"}
                      stroke="hsl(var(--primary))"
                      fill="url(#colorTrendValue)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="records"
                      name={language === "th" ? "จำนวนรายการ" : "Records"}
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">
                      {trendChartData.reduce((sum, d) => sum + d.records, 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "th" ? "รายการทั้งหมด" : "Total Records"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {trendChartData.reduce((sum, d) => sum + d.totalValue, 0).toLocaleString()}
                      {displayUnit && <span className="text-sm font-normal ml-1">{displayUnit}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "th" ? "ค่ารวม" : "Total Value"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-cyan-600">
                      {trendChartData.length > 0 
                        ? Math.round(trendChartData.reduce((sum, d) => sum + d.avgValue, 0) / trendChartData.length).toLocaleString()
                        : 0}
                      {displayUnit && <span className="text-sm font-normal ml-1">{displayUnit}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "th" ? "ค่าเฉลี่ย" : "Average"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {trendChartData.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "th" ? "จุดข้อมูล" : "Data Points"}
                    </p>
                  </div>
                </div>

                {/* Trend Analytics */}
                {trendChartData.length >= 2 && (
                  <div className="mt-4">
                    <TrendAnalytics 
                      trendData={trendChartData} 
                      color="hsl(var(--primary))"
                      measure="totalValue"
                      unitLabel={displayUnit || undefined}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                {language === "th" ? "ไม่มีข้อมูลสำหรับตัวกรองที่เลือก" : "No data for selected filters"}
              </div>
            );
          })()}
        </CardContent>
      </Card>
      )}

      {/* Theme Trend Charts with Drill-down */}
      {isSectionVisible("themes") && (
      <Card id="section-themes" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {language === "th" ? "แนวโน้มตามหัวข้อ ESG" : "ESG Theme Trends"}
          </CardTitle>
          <CardDescription>
            {language === "th" 
              ? "คลิกที่หัวข้อเพื่อดูรายละเอียดเพิ่มเติม" 
              : "Click on a theme to view detailed breakdown"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {themesWithTrend.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {themesWithTrend.map((theme) => {
                const color = getDimensionColor(theme.dimensionName);
                const DimIcon = getDimensionIcon(theme.dimensionName);
                
                return (
                  <div
                    key={theme.theme_id}
                    className="p-4 rounded-xl border bg-card hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => {
                      setSelectedTheme(theme.theme_id);
                      setDrilldownDialogOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <DimIcon className="h-4 w-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" title={theme.name}>
                            {theme.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{theme.dimensionName}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {theme.recordCount} {language === "th" ? "รายการ" : "records"}
                      </Badge>
                      <span className="text-sm font-semibold" style={{ color }}>
                        {theme.completionRate}%
                      </span>
                    </div>
                    
                    {/* Mini Trend Chart */}
                    {theme.trendData.length > 1 ? (
                      <div className="h-16 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={theme.trendData}>
                            <defs>
                              <linearGradient id={`gradient-${theme.theme_id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="records"
                              stroke={color}
                              fill={`url(#gradient-${theme.theme_id})`}
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-16 mt-2 flex items-center justify-center text-xs text-muted-foreground">
                        {language === "th" ? "ข้อมูลไม่เพียงพอสำหรับแสดงกราฟ" : "Insufficient data for trend"}
                      </div>
                    )}
                    
                    {/* Trend Analytics */}
                    {theme.trendData.length >= 2 && (
                      <TrendAnalytics trendData={theme.trendData} color={color} compact />
                    )}
                    
                    <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      <span>{language === "th" ? "คลิกเพื่อดูรายละเอียด" : "Click to view details"}</span>
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              {language === "th" ? "ไม่มีข้อมูล" : "No data"}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Themes & Metrics Section */}
      {isSectionVisible("top-data") && (
      <div id="section-top-data" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-4">
        {/* Top Themes by Records */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Leaf className="h-5 w-5 text-primary" />
              {language === "th" ? "หัวข้อ ESG ที่มีข้อมูลมากที่สุด" : "Top ESG Themes by Records"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {themeData.length > 0 ? (
              <div className="space-y-3">
                {themeData.slice(0, 6).map((theme, index) => (
                  <div
                    key={theme.theme_id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTheme(theme.theme_id);
                      setDrilldownDialogOpen(true);
                    }}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm"
                      style={{
                        backgroundColor: `${getDimensionColor(theme.dimensionName)}20`,
                        color: getDimensionColor(theme.dimensionName),
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{theme.name}</p>
                      <p className="text-xs text-muted-foreground">{theme.dimensionName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-medium">
                        {theme.recordCount} {language === "th" ? "รายการ" : "records"}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                {language === "th" ? "ไม่มีข้อมูล" : "No data"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {language === "th" ? "ตัวชี้วัดที่บันทึกมากที่สุด" : "Most Recorded Metrics"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topMetrics.length > 0 ? (
              <div className="space-y-3">
                {topMetrics.slice(0, 6).map((metric, index) => (
                  <div
                    key={metric.metric_id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={metric.name}>
                        {metric.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{metric.dimension}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="font-medium">
                        {metric.count} {language === "th" ? "รายการ" : "records"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                {language === "th" ? "ไม่มีข้อมูล" : "No data"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Site Performance */}
      {isSectionVisible("sites") && (
      <Card id="section-sites" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {language === "th" ? "ประสิทธิภาพตามสถานที่" : "Site Performance"}
          </CardTitle>
          <CardDescription>
            {language === "th" ? "อัตราความสำเร็จในการส่งข้อมูลแต่ละสถานที่" : "Data submission completion rate by site"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sitePerformance.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sitePerformance.map((site) => (
                <div
                  key={site.site_id}
                  className="p-4 rounded-lg border bg-card hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{site.name}</p>
                        <p className="text-xs text-muted-foreground">{site.company}</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-primary">{site.completionRate}%</span>
                  </div>
                  <Progress value={site.completionRate} className="h-2 mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {site.submitted} {language === "th" ? "ส่งแล้ว" : "submitted"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {site.draft} {language === "th" ? "ร่าง" : "draft"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              {language === "th" ? "ไม่มีข้อมูล" : "No data"}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Dimension Bar Chart */}
      {isSectionVisible("comparison") && (
      <Card id="section-comparison" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {language === "th" ? "เปรียบเทียบข้อมูลตามมิติ ESG" : "ESG Dimension Comparison"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dimensionData.some((d) => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dimensionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="name" width={120} className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="submitted"
                  name={language === "th" ? "ส่งแล้ว" : "Submitted"}
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="draft"
                  name={language === "th" ? "ร่าง" : "Draft"}
                  fill="hsl(var(--muted-foreground))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center text-muted-foreground">
              {language === "th" ? "ไม่มีข้อมูล" : "No data"}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Drill-down Dialog */}
      <Dialog open={drilldownDialogOpen} onOpenChange={setDrilldownDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          {selectedThemeDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${getDimensionColor(selectedThemeDetails.dimension?.dimension_name || "")}20` }}
                  >
                    {(() => {
                      const DimIcon = getDimensionIcon(selectedThemeDetails.dimension?.dimension_name || "");
                      return <DimIcon className="h-5 w-5" style={{ color: getDimensionColor(selectedThemeDetails.dimension?.dimension_name || "") }} />;
                    })()}
                  </div>
                  <div>
                    <span>{selectedThemeDetails.theme.theme_name}</span>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      {selectedThemeDetails.dimension?.dimension_name}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-4 pt-2">
                  <Badge variant="secondary">
                    {selectedThemeDetails.totalRecords} {language === "th" ? "รายการทั้งหมด" : "total records"}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {selectedThemeDetails.submittedRecords} {language === "th" ? "ส่งแล้ว" : "submitted"}
                  </Badge>
                  <span className="text-sm">
                    {selectedThemeDetails.totalRecords > 0 
                      ? Math.round((selectedThemeDetails.submittedRecords / selectedThemeDetails.totalRecords) * 100) 
                      : 0}% {language === "th" ? "สำเร็จ" : "complete"}
                  </span>
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[calc(90vh-180px)]">
                <div className="space-y-6 pr-4">
                  {/* Trend Chart */}
                  {selectedThemeDetails.trendData.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        {language === "th" ? "แนวโน้มรายเดือน" : "Monthly Trend"}
                      </h4>
                      <div className="h-64 bg-muted/20 rounded-lg p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={selectedThemeDetails.trendData}>
                            <defs>
                              <linearGradient id="drilldownGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="records"
                              name={language === "th" ? "จำนวนรายการ" : "Records"}
                              stroke="hsl(var(--primary))"
                              fill="url(#drilldownGradient)"
                              strokeWidth={2}
                            />
                            <Line
                              type="monotone"
                              dataKey="submitted"
                              name={language === "th" ? "ส่งแล้ว" : "Submitted"}
                              stroke="hsl(var(--chart-2))"
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--chart-2))" }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Trend Analytics - Full View */}
                      {selectedThemeDetails.trendData.length >= 2 && (
                        <div className="mt-4">
                          <TrendAnalytics 
                            trendData={selectedThemeDetails.trendData} 
                            color={getDimensionColor(selectedThemeDetails.dimension?.dimension_name || "")} 
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Metric Breakdown */}
                  {selectedThemeDetails.metricBreakdown.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        {language === "th" ? "รายละเอียดตัวชี้วัด" : "Metric Breakdown"}
                      </h4>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === "th" ? "ตัวชี้วัด" : "Metric"}</TableHead>
                              <TableHead className="text-center">{language === "th" ? "หน่วย" : "Unit"}</TableHead>
                              <TableHead className="text-center">{language === "th" ? "รายการ" : "Records"}</TableHead>
                              <TableHead className="text-right">{language === "th" ? "รวม" : "Total"}</TableHead>
                              <TableHead className="text-right">{language === "th" ? "เฉลี่ย" : "Average"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedThemeDetails.metricBreakdown.map((metric) => (
                              <TableRow key={metric.metric_id}>
                                <TableCell className="font-medium">{metric.name}</TableCell>
                                <TableCell className="text-center text-muted-foreground">
                                  {metric.unit || "-"}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary">{metric.recordCount}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {metric.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {metric.avgValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Site Breakdown */}
                  {selectedThemeDetails.siteBreakdown.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {language === "th" ? "รายละเอียดตามสถานที่" : "Site Breakdown"}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedThemeDetails.siteBreakdown.slice(0, 6).map((site) => {
                          const completionRate = site.recordCount > 0
                            ? Math.round((site.submittedCount / site.recordCount) * 100)
                            : 0;
                          return (
                            <div
                              key={site.site_id}
                              className="p-3 rounded-lg border bg-muted/20"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-sm">{site.name}</p>
                                  <p className="text-xs text-muted-foreground">{site.company}</p>
                                </div>
                                <span className="text-lg font-bold text-primary">{completionRate}%</span>
                              </div>
                              <Progress value={completionRate} className="h-1.5 mb-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{site.submittedCount} {language === "th" ? "ส่งแล้ว" : "submitted"}</span>
                                <span>{site.recordCount} {language === "th" ? "รายการ" : "records"}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
