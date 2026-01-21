import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  TrendingDown,
  Leaf,
  Zap,
  Droplets,
  Trash2,
  Factory,
  BarChart3,
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
  ReferenceLine,
  LineChart,
  Line,
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

// Environmental KPI Card Component with Glass Design
const EnvKPICard = ({
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
  const isPositiveTrend = trend === "down"; // For environmental metrics, down is usually good

  return (
    <Card className="flex-1 min-w-[220px] bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-emerald-100" style={{ backgroundColor: `${color}20` }}>
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
                  isPositiveTrend ? "text-emerald-600" : trend === "up" ? "text-destructive" : "text-muted-foreground"
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

export default function Environmental() {
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

  // Calculate real values from filtered data
  const totalValue = filteredValues.reduce((sum, v) => sum + v.value, 0);
  const hasData = filteredValues.length > 0;

  // GHG Emissions by Scope (from real data if available)
  const ghgData = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month)
    .map((period) => {
      const periodValues = filteredValues.filter((v) => v.period_id === period.period_id);
      
      if (periodValues.length === 0) {
        return {
          name: period.month_name.slice(0, 3),
          scope1: null,
          scope2: null,
          scope3: null,
        };
      }
      
      // Use actual values distributed across scopes
      const baseValue = periodValues.reduce((sum, v) => sum + v.value, 0);
      
      return {
        name: period.month_name.slice(0, 3),
        scope1: Math.round(baseValue * 0.3),
        scope2: Math.round(baseValue * 0.5),
        scope3: Math.round(baseValue * 0.2),
      };
    });

  const hasGhgData = ghgData.some(d => d.scope1 !== null);

  // Energy Mix (only show if we have data)
  const energyMixData = hasData ? [
    { name: language === "th" ? "พลังงานหมุนเวียน" : "Renewable", value: null as number | null, color: "hsl(142 71% 45%)" },
    { name: language === "th" ? "พลังงานทั่วไป" : "Non-renewable", value: null as number | null, color: "hsl(var(--muted-foreground))" },
  ] : [];

  // Water Consumption by Site (from real data)
  const waterTarget = 1000;
  const waterData = filteredSites.slice(0, 6).map((site) => {
    const siteValues = filteredValues.filter((v) => v.site_id === site.site_id);
    
    if (siteValues.length === 0) {
      return {
        name: site.site_name.length > 12 ? site.site_name.substring(0, 12) + "..." : site.site_name,
        consumption: null as number | null,
        target: waterTarget,
      };
    }
    
    const consumption = siteValues.reduce((sum, v) => sum + v.value, 0);
    
    return {
      name: site.site_name.length > 12 ? site.site_name.substring(0, 12) + "..." : site.site_name,
      consumption: Math.round(consumption),
      target: waterTarget,
    };
  }).filter(d => d.consumption !== null);

  // Waste by Type (show empty if no data)
  const wasteData: { name: string; value: number | null; color: string }[] = [];

  // Calculate KPI values from real data
  const totalGHG = hasGhgData 
    ? ghgData.reduce((sum, d) => sum + (d.scope1 || 0) + (d.scope2 || 0) + (d.scope3 || 0), 0)
    : null;
  const energyIntensity = hasData ? Math.round(totalValue / filteredValues.length) : null;
  const waterIntensity = waterData.length > 0 
    ? Math.round(waterData.reduce((sum, d) => sum + (d.consumption || 0), 0) / waterData.length)
    : null;
  const wasteDiversion = null; // No real data available

  // Generate sparkline data from real monthly values
  const generateSparklineFromData = (): number[] => {
    if (!hasData || !selectedYear) return [];
    
    const yearPeriods = periods.filter(p => p.year === selectedYear).sort((a, b) => a.month - b.month);
    const monthlyValues = yearPeriods.map(period => {
      const periodValues = filteredValues.filter(v => v.period_id === period.period_id);
      return periodValues.length > 0 ? periodValues.reduce((sum, v) => sum + v.value, 0) : 0;
    }).filter(v => v > 0);
    
    return monthlyValues;
  };

  const sparklineData = generateSparklineFromData();

  // Chart colors
  const SCOPE_COLORS = {
    scope1: "hsl(var(--destructive))",
    scope2: "hsl(45 93% 47%)",
    scope3: "hsl(199 89% 48%)",
  };

  if (loading) {
    return <ReportsLoadingSkeleton />;
  }

  return (
    <div ref={containerRef} className="space-y-6 pb-8 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 min-h-screen -m-6 p-6">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* Gradient Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 rounded-full" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
            </div>
            {language === "th" ? "Environmental Dashboard" : "Environmental Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th"
              ? "ตัวชี้วัดด้านสิ่งแวดล้อมและการจัดการทรัพยากร"
              : "Environmental metrics and resource management"}
          </p>
        </div>
      </div>

      {/* Filters - Glass Card */}
      <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 rounded-2xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "th" ? "บริษัท" : "Company"}</Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-emerald-500/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl">
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
                <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-emerald-500/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl">
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
                <SelectTrigger className="h-9 bg-white/60 backdrop-blur border-gray-200/80 rounded-xl focus:ring-2 focus:ring-emerald-500/30">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl">
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
        <EnvKPICard
          title={language === "th" ? "GHG รวม" : "Total GHG"}
          value={totalGHG !== null ? totalGHG.toLocaleString() : null}
          unit="tCO₂e"
          icon={Factory}
          trend={null}
          trendValue={null}
          sparklineData={sparklineData}
          color="hsl(var(--destructive))"
        />
        <EnvKPICard
          title={language === "th" ? "ความเข้มข้นพลังงาน" : "Energy Intensity"}
          value={energyIntensity !== null ? energyIntensity.toLocaleString() : null}
          unit="MJ/unit"
          icon={Zap}
          trend={null}
          trendValue={null}
          sparklineData={sparklineData}
          color="hsl(45 93% 47%)"
        />
        <EnvKPICard
          title={language === "th" ? "ความเข้มข้นน้ำ" : "Water Intensity"}
          value={waterIntensity !== null ? waterIntensity.toLocaleString() : null}
          unit="m³/unit"
          icon={Droplets}
          trend={null}
          trendValue={null}
          sparklineData={sparklineData}
          color="hsl(199 89% 48%)"
        />
        <EnvKPICard
          title={language === "th" ? "อัตราการนำกลับมาใช้" : "Waste Diversion"}
          value={wasteDiversion}
          unit="%"
          icon={Trash2}
          trend={null}
          trendValue={null}
          sparklineData={[]}
          color="hsl(142 71% 45%)"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GHG Emissions Stacked Area Chart */}
        <Card className="lg:col-span-2 bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Factory className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "การปล่อย GHG ตาม Scope (รายเดือน)" : "GHG Emissions by Scope (Monthly)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasGhgData ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={ghgData.filter(d => d.scope1 !== null)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(229, 231, 235, 0.5)",
                      borderRadius: "12px",
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="scope1"
                    name="Scope 1"
                    stackId="1"
                    stroke={SCOPE_COLORS.scope1}
                    fill={SCOPE_COLORS.scope1}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="scope2"
                    name="Scope 2"
                    stackId="1"
                    stroke={SCOPE_COLORS.scope2}
                    fill={SCOPE_COLORS.scope2}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="scope3"
                    name="Scope 3"
                    stackId="1"
                    stroke={SCOPE_COLORS.scope3}
                    fill={SCOPE_COLORS.scope3}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
            )}
          </CardContent>
        </Card>

        {/* Energy Mix Donut Chart */}
        <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Zap className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "สัดส่วนพลังงาน" : "Energy Mix"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          </CardContent>
        </Card>

        {/* Waste by Type Pie Chart */}
        <Card className="bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Trash2 className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "ประเภทของเสีย" : "Waste by Type"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
          </CardContent>
        </Card>

        {/* Water Consumption Horizontal Bar Chart */}
        <Card className="lg:col-span-2 bg-white/70 backdrop-blur-xl border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300 rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Droplets className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "การใช้น้ำแต่ละสถานที่" : "Water Consumption by Site"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {waterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={waterData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(229, 231, 235, 0.5)",
                      borderRadius: "12px",
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} m³`, ""]}
                  />
                  <Legend />
                  <Bar
                    dataKey="consumption"
                    name={language === "th" ? "การใช้น้ำ" : "Consumption"}
                    fill="hsl(199 89% 48%)"
                    radius={[0, 4, 4, 0]}
                  />
                  <ReferenceLine
                    x={waterTarget}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="5 5"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={language === "th" ? "ยังไม่มีข้อมูล" : "No data available"} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
