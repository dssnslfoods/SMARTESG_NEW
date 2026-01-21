import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  GitCompare,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Target,
  BarChart3,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
  Cell,
  ZAxis,
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

interface EsgTheme {
  theme_id: string;
  theme_name: string;
  dimension_id: string;
}

interface EsgMetric {
  metric_id: string;
  metric_name: string;
  theme_id: string;
  unit: string | null;
}

interface MetricValue {
  value_id: string;
  metric_id: string;
  site_id: string;
  period_id: string;
  value: number;
  status: string;
}

// Empty State Component
const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
    <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
    <p>{message}</p>
  </div>
);

// Lollipop Chart Component
const LollipopChart = ({
  data,
  averageScore,
  language,
}: {
  data: { name: string; score: number | null; color: string }[];
  averageScore: number | null;
  language: string;
}) => {
  const maxScore = 100;
  const hasData = data.some(item => item.score !== null);
  
  if (!hasData) {
    return <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />;
  }
  
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-24 sm:w-32 text-xs sm:text-sm text-right truncate text-muted-foreground">
            {item.name}
          </div>
          <div className="flex-1 relative h-6 flex items-center">
            {/* Background track */}
            <div className="absolute inset-y-2 left-0 right-0 bg-muted rounded-full" />
            
            {/* Average line */}
            {averageScore !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
                style={{ left: `${(averageScore / maxScore) * 100}%` }}
              />
            )}
            
            {/* Lollipop line */}
            {item.score !== null && (
              <>
                <div
                  className="absolute h-0.5 rounded-full"
                  style={{
                    width: `${(item.score / maxScore) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
                
                {/* Lollipop circle */}
                <div
                  className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-background shadow-sm z-20"
                  style={{
                    left: `calc(${(item.score / maxScore) * 100}% - 6px)`,
                    backgroundColor: item.color,
                  }}
                />
              </>
            )}
          </div>
          <div className="w-10 text-xs sm:text-sm font-medium text-right">
            {item.score !== null ? item.score : "-"}
          </div>
        </div>
      ))}
      
      {/* Legend */}
      {averageScore !== null && (
        <div className="flex items-center justify-end gap-4 mt-4 pt-2 border-t">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-0.5 bg-destructive" />
            <span>{language === "th" ? "ค่าเฉลี่ยบริษัท" : "Company Avg"}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Mini Line Chart for Small Multiples
const MiniLineChart = ({
  data,
  title,
  color,
  yDomain,
}: {
  data: { month: string; value: number | null }[];
  title: string;
  color: string;
  yDomain: [number, number];
}) => {
  const hasData = data.some(d => d.value !== null);
  const lastValue = data.length > 0 ? data[data.length - 1]?.value : null;
  
  return (
    <Card className="p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2 truncate">{title}</p>
      <div className="h-16">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
              <YAxis domain={yDomain} hide />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            -
          </div>
        )}
      </div>
      <p className="text-xs text-center mt-1 font-medium">
        {lastValue !== null ? lastValue : "-"}
      </p>
    </Card>
  );
};

// Quadrant labels
const QUADRANT_LABELS = {
  en: { stars: "Stars", questionMarks: "Question Marks", cashCows: "Cash Cows", dogs: "Dogs" },
  th: { stars: "ดาวเด่น", questionMarks: "มีศักยภาพ", cashCows: "มั่นคง", dogs: "ต้องปรับปรุง" },
};

type SortField = "site" | "eScore" | "sScore" | "gScore" | "overall" | "rank" | "vsTarget";
type SortDirection = "asc" | "desc";

export default function Benchmarking() {
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
  const [filterYear, setFilterYear] = useState<string>("");

  // Sort state
  const [sortField, setSortField] = useState<SortField>("overall");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
  const selectedYear = filterYear ? parseInt(filterYear) : uniqueYears[0];

  // Filter sites by company
  const filteredSites = filterCompany ? sites.filter((s) => s.company_id === filterCompany) : sites;

  // Filter values
  const filteredValues = metricValues.filter((v) => {
    if (filterCompany) {
      const site = sites.find((s) => s.site_id === v.site_id);
      if (site?.company_id !== filterCompany) return false;
    }
    if (filterYear) {
      const period = periods.find((p) => p.period_id === v.period_id);
      if (period?.year !== parseInt(filterYear)) return false;
    }
    return true;
  });

  // Helper: Get dimension score for a site (returns null if no data)
  const getDimensionScore = (siteId: string, dimensionName: string): number | null => {
    const dim = dimensions.find((d) => {
      const name = d.dimension_name.toLowerCase();
      return (
        name.includes(dimensionName.toLowerCase()) ||
        (dimensionName === "environment" && name.includes("สิ่งแวดล้อม")) ||
        (dimensionName === "social" && name.includes("สังคม")) ||
        (dimensionName === "governance" && name.includes("ธรรมาภิบาล"))
      );
    });

    if (!dim) return null;

    const dimThemes = themes.filter((t) => t.dimension_id === dim.dimension_id);
    const dimMetrics = metrics.filter((m) => dimThemes.some((t) => t.theme_id === m.theme_id));
    const siteValues = filteredValues.filter(
      (v) => v.site_id === siteId && dimMetrics.some((m) => m.metric_id === v.metric_id)
    );

    if (siteValues.length === 0) return null;

    const submitted = siteValues.filter((v) => v.status === "submitted").length;
    return Math.round((submitted / siteValues.length) * 100);
  };

  // Calculate site performance data
  const sitePerformance = useMemo(() => {
    const target = 80;
    
    return filteredSites.map((site) => {
      const company = companies.find((c) => c.company_id === site.company_id);
      const eScore = getDimensionScore(site.site_id, "environment");
      const sScore = getDimensionScore(site.site_id, "social");
      const gScore = getDimensionScore(site.site_id, "governance");
      
      // Only calculate overall if at least one score exists
      const scores = [eScore, sScore, gScore].filter((s): s is number => s !== null);
      const overall = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      
      // Calculate improvement rate from historical data (null if not enough data)
      const siteValues = filteredValues.filter((v) => v.site_id === site.site_id);
      const improvementRate = siteValues.length >= 2 ? null : null; // Would need historical comparison
      
      return {
        site_id: site.site_id,
        site: site.site_name,
        company: company?.company_name || "",
        eScore,
        sScore,
        gScore,
        overall,
        improvementRate,
        vsTarget: overall !== null ? overall - target : null,
        size: 100,
      };
    });
  }, [filteredSites, companies, filteredValues, dimensions, themes, metrics]);

  // Calculate average score (only from sites with data)
  const sitesWithData = sitePerformance.filter((s) => s.overall !== null);
  const averageScore = sitesWithData.length > 0
    ? Math.round(sitesWithData.reduce((sum, s) => sum + (s.overall || 0), 0) / sitesWithData.length)
    : null;

  // Lollipop data (sorted by score descending)
  const lollipopData = [...sitePerformance]
    .filter((s) => s.overall !== null)
    .sort((a, b) => (b.overall || 0) - (a.overall || 0))
    .slice(0, 10)
    .map((s) => ({
      name: s.site.length > 15 ? s.site.substring(0, 15) + "..." : s.site,
      score: s.overall,
      color: s.overall !== null && s.overall >= 70 ? "hsl(142 71% 45%)" : s.overall !== null && s.overall >= 50 ? "hsl(45 93% 47%)" : "hsl(var(--destructive))",
    }));

  // Scatter plot data for Performance Matrix
  const scatterData = sitePerformance
    .filter((s) => s.overall !== null && s.improvementRate !== null)
    .map((s) => ({
      x: s.overall,
      y: s.improvementRate,
      z: s.size,
      name: s.site,
      quadrant:
        (s.overall || 0) >= 50 && (s.improvementRate || 0) >= 0
          ? "stars"
          : (s.overall || 0) < 50 && (s.improvementRate || 0) >= 0
          ? "questionMarks"
          : (s.overall || 0) >= 50 && (s.improvementRate || 0) < 0
          ? "cashCows"
          : "dogs",
    }));

  // Small multiples data (top 9 sites)
  const smallMultiplesData = useMemo(() => {
    const yearPeriods = periods.filter((p) => p.year === selectedYear).sort((a, b) => a.month - b.month);
    const yValues: number[] = [];
    
    const siteData = filteredSites.slice(0, 9).map((site) => {
      const monthlyData = yearPeriods.map((period) => {
        const periodValues = metricValues.filter(
          (v) => v.site_id === site.site_id && v.period_id === period.period_id
        );
        
        if (periodValues.length === 0) {
          return {
            month: period.month_name.slice(0, 3),
            value: null as number | null,
          };
        }
        
        const submitted = periodValues.filter((v) => v.status === "submitted").length;
        const score = Math.round((submitted / periodValues.length) * 100);
        yValues.push(score);
        
        return {
          month: period.month_name.slice(0, 3),
          value: score,
        };
      });

      return {
        site_id: site.site_id,
        name: site.site_name,
        data: monthlyData,
      };
    });

    const yMin = yValues.length > 0 ? Math.min(...yValues, 0) : 0;
    const yMax = yValues.length > 0 ? Math.max(...yValues, 100) : 100;
    
    return { sites: siteData, yDomain: [yMin, yMax] as [number, number] };
  }, [filteredSites, periods, metricValues, selectedYear]);

  // Sorted table data
  const sortedTableData = useMemo(() => {
    const ranked = [...sitePerformance]
      .sort((a, b) => (b.overall || 0) - (a.overall || 0))
      .map((s, index) => ({ ...s, rank: s.overall !== null ? index + 1 : null }));

    return ranked.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      // Handle null values
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [sitePerformance, sortField, sortDirection]);

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Site", "Company", "E Score", "S Score", "G Score", "Overall", "Rank", "vs Target"];
    const rows = sortedTableData.map((s) => [
      s.site,
      s.company,
      s.eScore !== null ? s.eScore : "-",
      s.sScore !== null ? s.sScore : "-",
      s.gScore !== null ? s.gScore : "-",
      s.overall !== null ? s.overall : "-",
      s.rank !== null ? s.rank : "-",
      s.vsTarget !== null ? (s.vsTarget >= 0 ? `+${s.vsTarget}` : s.vsTarget) : "-",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-benchmarking-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quadrant colors
  const getQuadrantColor = (quadrant: string) => {
    switch (quadrant) {
      case "stars":
        return "hsl(142 71% 45%)";
      case "questionMarks":
        return "hsl(199 89% 48%)";
      case "cashCows":
        return "hsl(45 93% 47%)";
      default:
        return "hsl(var(--destructive))";
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  if (loading) {
    return <ReportsLoadingSkeleton />;
  }

  const labels = language === "th" ? QUADRANT_LABELS.th : QUADRANT_LABELS.en;
  const hasAnyData = metricValues.length > 0;

  return (
    <div ref={containerRef} className="space-y-6 pb-8">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <GitCompare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {language === "th" ? "Site Benchmarking" : "Site Benchmarking"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th"
              ? "เปรียบเทียบประสิทธิภาพ ESG ระหว่างสถานที่"
              : "Compare ESG performance across sites"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Lollipop Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {language === "th" ? "อันดับ ESG Score ตามสถานที่" : "ESG Score Ranking by Site"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lollipopData.length > 0 ? (
            <LollipopChart data={lollipopData} averageScore={averageScore} language={language} />
          ) : (
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          )}
        </CardContent>
      </Card>

      {/* Performance Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {language === "th" ? "Performance Matrix" : "Performance Matrix"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scatterData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 100]}
                    name="Performance"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    label={{
                      value: language === "th" ? "ประสิทธิภาพปัจจุบัน" : "Current Performance",
                      position: "bottom",
                      offset: 20,
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[-20, 30]}
                    name="Improvement"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    label={{
                      value: language === "th" ? "อัตราการปรับปรุง (%)" : "Improvement Rate (%)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <ZAxis type="number" dataKey="z" range={[50, 200]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value}${name === "Improvement" ? "%" : ""}`,
                      name,
                    ]}
                    labelFormatter={(_, payload) => payload[0]?.payload?.name || ""}
                  />
                  {/* Quadrant dividers */}
                  <ReferenceLine x={50} stroke="hsl(var(--border))" strokeDasharray="5 5" />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="5 5" />
                  <Scatter name="Sites" data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getQuadrantColor(entry.quadrant)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>

              {/* Quadrant Legend */}
              <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(142 71% 45%)" }} />
                  <span>{labels.stars}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(199 89% 48%)" }} />
                  <span>{labels.questionMarks}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(45 93% 47%)" }} />
                  <span>{labels.cashCows}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--destructive))" }} />
                  <span>{labels.dogs}</span>
                </div>
              </div>
            </>
          ) : (
            <EmptyState message={language === "th" ? "ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์" : "Insufficient data for analysis"} />
          )}
        </CardContent>
      </Card>

      {/* Small Multiples Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {language === "th" ? "แนวโน้ม 12 เดือน ตามสถานที่" : "12-Month Trends by Site"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {smallMultiplesData.sites.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {smallMultiplesData.sites.map((site, index) => (
                <MiniLineChart
                  key={site.site_id}
                  data={site.data}
                  title={site.name}
                  color={`hsl(${(index * 40) % 360} 70% 50%)`}
                  yDomain={smallMultiplesData.yDomain}
                />
              ))}
            </div>
          ) : (
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">
            {language === "th" ? "ตารางเปรียบเทียบ" : "Comparison Table"}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("site")}
                  >
                    <div className="flex items-center">
                      {language === "th" ? "สถานที่" : "Site"}
                      <SortIcon field="site" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort("eScore")}
                  >
                    <div className="flex items-center justify-center">
                      E
                      <SortIcon field="eScore" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort("sScore")}
                  >
                    <div className="flex items-center justify-center">
                      S
                      <SortIcon field="sScore" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort("gScore")}
                  >
                    <div className="flex items-center justify-center">
                      G
                      <SortIcon field="gScore" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort("overall")}
                  >
                    <div className="flex items-center justify-center">
                      {language === "th" ? "รวม" : "Overall"}
                      <SortIcon field="overall" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort("rank")}
                  >
                    <div className="flex items-center justify-center">
                      {language === "th" ? "อันดับ" : "Rank"}
                      <SortIcon field="rank" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort("vsTarget")}
                  >
                    <div className="flex items-center justify-center">
                      vs Target
                      <SortIcon field="vsTarget" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTableData.length > 0 ? (
                  sortedTableData.map((row) => (
                    <TableRow key={row.site_id}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="truncate max-w-[150px]">{row.site}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {row.company}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{row.eScore !== null ? row.eScore : "-"}</TableCell>
                      <TableCell className="text-center">{row.sScore !== null ? row.sScore : "-"}</TableCell>
                      <TableCell className="text-center">{row.gScore !== null ? row.gScore : "-"}</TableCell>
                      <TableCell className="text-center font-semibold">{row.overall !== null ? row.overall : "-"}</TableCell>
                      <TableCell className="text-center">
                        {row.rank !== null ? (
                          <Badge variant={row.rank <= 3 ? "default" : "secondary"}>#{row.rank}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.vsTarget !== null ? (
                          <span
                            className={
                              row.vsTarget >= 0 ? "text-emerald-600 font-medium" : "text-destructive font-medium"
                            }
                          >
                            {row.vsTarget >= 0 ? `+${row.vsTarget}` : row.vsTarget}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {language === "th" ? "ไม่พบข้อมูล" : "No data found"}
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
