import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  FileCheck,
  Users,
  AlertTriangle,
  CheckCircle,
  BarChart3,
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
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
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
  <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
    <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
    <p>{message}</p>
  </div>
);

// Sparkline component for KPI cards
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  if (data.length === 0) {
    return <div className="h-8 w-20 flex items-center justify-center text-xs text-muted-foreground">-</div>;
  }
  
  const sparkData = data.map((value, index) => ({ value, index }));
  
  return (
    <div className="h-8 w-20">
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

// Governance KPI Card Component
const GovKPICard = ({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  sparklineData,
  color,
}: {
  title: string;
  value: string | number | null;
  unit: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral" | null;
  trendValue?: string | null;
  sparklineData: number[];
  color: string;
}) => {
  const isPositiveTrend = trend === "up"; // For governance metrics, up is usually good

  return (
    <Card className="flex-1 min-w-[220px]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <p className="text-xs text-muted-foreground">{title}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold">
                {value !== null ? value : "-"}
              </span>
              {value !== null && <span className="text-xs text-muted-foreground">{unit}</span>}
            </div>
            {trend && trendValue && (
              <div
                className={`flex items-center gap-0.5 text-xs mt-1 ${
                  isPositiveTrend ? "text-emerald-600" : trend === "down" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {trend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trend === "down" ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>{trendValue} YoY</span>
              </div>
            )}
            {!trend && !trendValue && value !== null && (
              <div className="text-xs mt-1 text-muted-foreground">
                -
              </div>
            )}
          </div>
          <Sparkline data={sparklineData} color={color} />
        </div>
      </CardContent>
    </Card>
  );
};

export default function Governance() {
  const { language } = useLanguage();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [themes, setThemes] = useState<EsgTheme[]>([]);
  const [metrics, setMetrics] = useState<EsgMetric[]>([]);
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");

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
        { data: themesData },
        { data: metricsData },
        { data: valuesData },
      ] = await Promise.all([
        supabase.from("company").select("*").order("company_name"),
        supabase.from("site").select("*").order("site_name"),
        supabase.from("reporting_period").select("*").order("year", { ascending: false }),
        supabase.from("esg_theme").select("*").order("theme_name"),
        supabase.from("esg_metric").select("*").order("metric_name"),
        supabase.from("metric_value").select("*"),
      ]);

      setCompanies(companiesData || []);
      setSites(sitesData || []);
      setPeriods(periodsData || []);
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
    if (filterSite) {
      if (v.site_id !== filterSite) return false;
    }
    if (filterYear) {
      const period = periods.find((p) => p.period_id === v.period_id);
      if (period?.year !== parseInt(filterYear)) return false;
    }
    return true;
  });

  const hasData = filteredValues.length > 0;

  // Board Composition Data (empty - no real data)
  const boardCompositionData: { name: string; value: number; color: string }[] = [];

  // Compliance Score by Category (empty - would need specific metrics)
  const complianceRadarData: { subject: string; score: number; fullMark: number }[] = [];

  // Policy Compliance Trend (empty - would need specific metrics)
  const complianceTrendData = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month)
    .map((period) => ({
      name: period.month_name.slice(0, 3),
      compliance: null as number | null,
      target: null as number | null,
    }));

  const hasComplianceTrendData = complianceTrendData.some(d => d.compliance !== null);

  // Risk Assessment by Category (empty - no real data)
  const riskData: { name: string; value: number; color: string }[] = [];

  // Audit Findings Over Time (empty - would need specific metrics)
  const auditData = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month)
    .map((period) => ({
      name: period.month_name.slice(0, 3),
      critical: null as number | null,
      major: null as number | null,
      minor: null as number | null,
    }));

  const hasAuditData = auditData.some(d => d.critical !== null);

  // Calculate KPI values (null if no real data)
  const complianceRate = null;
  const boardIndependence = null;
  const riskScore = null;
  const auditCompletion = null;

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
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            {language === "th" ? "Governance Dashboard" : "Governance Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th"
              ? "ตัวชี้วัดด้านธรรมาภิบาลและการกำกับดูแลกิจการ"
              : "Governance metrics and corporate oversight"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GovKPICard
          title={language === "th" ? "อัตราการปฏิบัติตาม" : "Compliance Rate"}
          value={complianceRate}
          unit="%"
          icon={FileCheck}
          trend={null}
          trendValue={null}
          sparklineData={[]}
          color="hsl(142 71% 45%)"
        />
        <GovKPICard
          title={language === "th" ? "สัดส่วนกรรมการอิสระ" : "Board Independence"}
          value={boardIndependence}
          unit="%"
          icon={Users}
          trend={null}
          trendValue={null}
          sparklineData={[]}
          color="hsl(262 83% 58%)"
        />
        <GovKPICard
          title={language === "th" ? "คะแนนความเสี่ยง" : "Risk Score"}
          value={riskScore}
          unit="/100"
          icon={AlertTriangle}
          trend={null}
          trendValue={null}
          sparklineData={[]}
          color="hsl(45 93% 47%)"
        />
        <GovKPICard
          title={language === "th" ? "การตรวจสอบเสร็จสิ้น" : "Audit Completion"}
          value={auditCompletion}
          unit="%"
          icon={CheckCircle}
          trend={null}
          trendValue={null}
          sparklineData={[]}
          color="hsl(199 89% 48%)"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Board Composition (Pie Chart) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "องค์ประกอบคณะกรรมการ" : "Board Composition"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          </CardContent>
        </Card>

        {/* Compliance Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "คะแนนการปฏิบัติตามตามหมวดหมู่" : "Compliance Score by Category"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          </CardContent>
        </Card>

        {/* Compliance Trend (Line Chart) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "แนวโน้มการปฏิบัติตามนโยบาย (รายเดือน)" : "Policy Compliance Trend (Monthly)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          </CardContent>
        </Card>

        {/* Risk Assessment (Horizontal Bar Chart) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "การประเมินความเสี่ยงตามหมวดหมู่" : "Risk Assessment by Category"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          </CardContent>
        </Card>

        {/* Audit Findings (Stacked Bar Chart) - Full Width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "ผลการตรวจสอบ (รายเดือน)" : "Audit Findings (Monthly)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
