import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Heart,
  GraduationCap,
  UserCheck,
  ShieldCheck,
  Smile,
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
  AreaChart,
  Area,
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

interface MetricValue {
  value_id: string;
  metric_id: string;
  site_id: string;
  period_id: string;
  value: number;
  status: string;
}

// Sparkline component for KPI cards
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
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

// Social KPI Card Component
const SocialKPICard = ({
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
  value: string | number;
  unit: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  sparklineData: number[];
  color: string;
}) => {
  const isPositiveTrend = trend === "up";

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
              <span className="text-xl sm:text-2xl font-bold">{value}</span>
              <span className="text-xs text-muted-foreground">{unit}</span>
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
          </div>
          <Sparkline data={sparklineData} color={color} />
        </div>
      </CardContent>
    </Card>
  );
};

export default function Social() {
  const { language } = useLanguage();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
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
        { data: valuesData },
      ] = await Promise.all([
        supabase.from("company").select("*").order("company_name"),
        supabase.from("site").select("*").order("site_name"),
        supabase.from("reporting_period").select("*").order("year", { ascending: false }),
        supabase.from("metric_value").select("*"),
      ]);

      setCompanies(companiesData || []);
      setSites(sitesData || []);
      setPeriods(periodsData || []);
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

  // Generate mock social data
  const totalValue = filteredValues.reduce((sum, v) => sum + v.value, 0);
  const avgValue = filteredValues.length > 0 ? totalValue / filteredValues.length : 0;

  // Gender Diversity (Pie Chart)
  const genderData = [
    { name: language === "th" ? "ชาย" : "Male", value: 58, color: "hsl(199 89% 48%)" },
    { name: language === "th" ? "หญิง" : "Female", value: 40, color: "hsl(330 81% 60%)" },
    { name: language === "th" ? "อื่นๆ" : "Other", value: 2, color: "hsl(45 93% 47%)" },
  ];

  // Age Distribution (Bar Chart)
  const ageData = [
    { name: "<25", value: 15, color: "hsl(142 71% 45%)" },
    { name: "25-34", value: 35, color: "hsl(199 89% 48%)" },
    { name: "35-44", value: 28, color: "hsl(262 83% 58%)" },
    { name: "45-54", value: 15, color: "hsl(45 93% 47%)" },
    { name: "55+", value: 7, color: "hsl(330 81% 60%)" },
  ];

  // Training Hours Trend (Area Chart)
  const trainingTrendData = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month)
    .map((period) => {
      const baseValue = 20 + Math.random() * 10;
      return {
        name: period.month_name.slice(0, 3),
        hours: Math.round(baseValue),
        target: 24,
      };
    });

  // Health & Safety Incidents (Line Chart)
  const safetyData = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month)
    .map((period) => ({
      name: period.month_name.slice(0, 3),
      incidents: Math.round(Math.random() * 3),
      nearMiss: Math.round(Math.random() * 5),
    }));

  // Employee Satisfaction by Category (Horizontal Bar)
  const satisfactionData = [
    { name: language === "th" ? "สภาพแวดล้อมการทำงาน" : "Work Environment", value: 85, color: "hsl(142 71% 45%)" },
    { name: language === "th" ? "สวัสดิการ" : "Benefits", value: 78, color: "hsl(199 89% 48%)" },
    { name: language === "th" ? "การพัฒนาอาชีพ" : "Career Development", value: 72, color: "hsl(262 83% 58%)" },
    { name: language === "th" ? "ความสมดุลชีวิต" : "Work-Life Balance", value: 80, color: "hsl(45 93% 47%)" },
    { name: language === "th" ? "ผู้นำ" : "Leadership", value: 82, color: "hsl(330 81% 60%)" },
  ];

  // Turnover Rate Trend (Line Chart)
  const turnoverData = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month)
    .map((period) => ({
      name: period.month_name.slice(0, 3),
      voluntary: Math.round(1 + Math.random() * 2),
      involuntary: Math.round(Math.random() * 1),
    }));

  // Calculate KPI values
  const totalEmployees = 2340 + Math.round(avgValue * 0.1);
  const trainingHours = 24;
  const employeeSatisfaction = 82;
  const safetyRate = 98.5;

  // Generate sparkline data
  const generateSparkline = (base: number) =>
    Array.from({ length: 12 }, () => Math.round(base * (0.9 + Math.random() * 0.2)));

  const employeeSparkline = generateSparkline(totalEmployees);
  const trainingSparkline = generateSparkline(trainingHours);
  const satisfactionSparkline = generateSparkline(employeeSatisfaction);
  const safetySparkline = generateSparkline(safetyRate);

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
            <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-rose-500" />
            {language === "th" ? "Social Dashboard" : "Social Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "th"
              ? "ตัวชี้วัดด้านสังคมและการพัฒนาบุคลากร"
              : "Social metrics and workforce development"}
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
        <SocialKPICard
          title={language === "th" ? "จำนวนพนักงาน" : "Total Employees"}
          value={totalEmployees.toLocaleString()}
          unit={language === "th" ? "คน" : "people"}
          icon={Users}
          trend="up"
          trendValue="+3.2%"
          sparklineData={employeeSparkline}
          color="hsl(199 89% 48%)"
        />
        <SocialKPICard
          title={language === "th" ? "ชั่วโมงอบรมเฉลี่ย" : "Avg Training Hours"}
          value={trainingHours}
          unit={language === "th" ? "ชม./คน" : "hrs/person"}
          icon={GraduationCap}
          trend="up"
          trendValue="+8.5%"
          sparklineData={trainingSparkline}
          color="hsl(262 83% 58%)"
        />
        <SocialKPICard
          title={language === "th" ? "ความพึงพอใจพนักงาน" : "Employee Satisfaction"}
          value={employeeSatisfaction}
          unit="%"
          icon={Smile}
          trend="up"
          trendValue="+2.1%"
          sparklineData={satisfactionSparkline}
          color="hsl(142 71% 45%)"
        />
        <SocialKPICard
          title={language === "th" ? "อัตราความปลอดภัย" : "Safety Rate"}
          value={safetyRate}
          unit="%"
          icon={ShieldCheck}
          trend="up"
          trendValue="+0.5%"
          sparklineData={safetySparkline}
          color="hsl(45 93% 47%)"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Diversity (Pie Chart) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "ความหลากหลายทางเพศ" : "Gender Diversity"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Age Distribution (Bar Chart) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "การกระจายตามอายุ" : "Age Distribution"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ageData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" name={language === "th" ? "เปอร์เซ็นต์" : "Percentage"} radius={[4, 4, 0, 0]}>
                  {ageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Training Hours Trend (Area Chart) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "ชั่วโมงอบรมรายเดือน" : "Training Hours (Monthly)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trainingTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trainingTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    name={language === "th" ? "ชั่วโมงอบรม" : "Training Hours"}
                    stroke="hsl(262 83% 58%)"
                    fill="hsl(262 83% 58%)"
                    fillOpacity={0.3}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name={language === "th" ? "เป้าหมาย" : "Target"}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                {language === "th" ? "ไม่มีข้อมูล" : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Satisfaction by Category (Horizontal Bar) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "ความพึงพอใจตามหมวดหมู่" : "Satisfaction by Category"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={satisfactionData} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" name={language === "th" ? "คะแนน" : "Score"} radius={[0, 4, 4, 0]}>
                  {satisfactionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Health & Safety Incidents (Line Chart) - Full Width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "เหตุการณ์ด้านความปลอดภัย (รายเดือน)" : "Safety Incidents (Monthly)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {safetyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={safetyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="incidents"
                    name={language === "th" ? "เหตุการณ์" : "Incidents"}
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="nearMiss"
                    name={language === "th" ? "เกือบเกิดเหตุ" : "Near Miss"}
                    stroke="hsl(45 93% 47%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(45 93% 47%)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                {language === "th" ? "ไม่มีข้อมูล" : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Turnover Rate (Stacked Bar Chart) - Full Width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {language === "th" ? "อัตราการลาออก (รายเดือน)" : "Turnover Rate (Monthly)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {turnoverData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={turnoverData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="voluntary"
                    name={language === "th" ? "สมัครใจ" : "Voluntary"}
                    stackId="a"
                    fill="hsl(199 89% 48%)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="involuntary"
                    name={language === "th" ? "ไม่สมัครใจ" : "Involuntary"}
                    stackId="a"
                    fill="hsl(var(--destructive))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                {language === "th" ? "ไม่มีข้อมูล" : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
