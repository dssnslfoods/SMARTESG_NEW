import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
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
} from "recharts";

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

  // Filters
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");

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

  // Filter sites by company
  const filteredSites = filterCompany
    ? sites.filter((s) => s.company_id === filterCompany)
    : sites;

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

  // Calculate summary stats
  const totalRecords = filteredValues.length;
  const draftCount = filteredValues.filter((v) => v.status === "draft").length;
  const submittedCount = filteredValues.filter((v) => v.status === "submitted").length;
  const completionRate = totalRecords > 0 ? Math.round((submittedCount / totalRecords) * 100) : 0;

  // Data by dimension
  const dimensionData = dimensions.map((dim) => {
    const dimThemes = themes.filter((t) => t.dimension_id === dim.dimension_id);
    const dimMetrics = metrics.filter((m) => dimThemes.some((t) => t.theme_id === m.theme_id));
    const dimValues = filteredValues.filter((v) =>
      dimMetrics.some((m) => m.metric_id === v.metric_id)
    );

    return {
      name: dim.dimension_name,
      total: dimValues.length,
      submitted: dimValues.filter((v) => v.status === "submitted").length,
      draft: dimValues.filter((v) => v.status === "draft").length,
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

  // Data by site
  const siteData = filteredSites
    .map((site) => {
      const siteValues = filteredValues.filter((v) => v.site_id === site.site_id);
      return {
        name: site.site_name.length > 15 ? site.site_name.slice(0, 15) + "..." : site.site_name,
        fullName: site.site_name,
        submitted: siteValues.filter((v) => v.status === "submitted").length,
        draft: siteValues.filter((v) => v.status === "draft").length,
        total: siteValues.length,
      };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Top metrics by value count
  const topMetrics = metrics
    .map((metric) => {
      const metricVals = filteredValues.filter((v) => v.metric_id === metric.metric_id);
      const theme = themes.find((t) => t.theme_id === metric.theme_id);
      const dimension = dimensions.find((d) => d.dimension_id === theme?.dimension_id);
      return {
        name: metric.metric_name.length > 20 ? metric.metric_name.slice(0, 20) + "..." : metric.metric_name,
        fullName: metric.metric_name,
        dimension: dimension?.dimension_name || "",
        count: metricVals.length,
        avgValue: metricVals.length > 0
          ? Math.round(metricVals.reduce((sum, v) => sum + v.value, 0) / metricVals.length)
          : 0,
      };
    })
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--muted-foreground))",
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {language === "th" ? "กำลังโหลด..." : "Loading..."}
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              {language === "th" ? "รายงาน ESG" : "ESG Reports"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === "th"
                ? "ภาพรวมและวิเคราะห์ข้อมูล ESG"
                : "ESG Data Overview & Analytics"}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {language === "th" ? "บริษัท" : "Company"}
              </Label>
              <Select
                value={filterCompany || "__all__"}
                onValueChange={(v) => setFilterCompany(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {language === "th" ? "ทั้งหมด" : "All"}
                  </SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.company_id} value={c.company_id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {language === "th" ? "ปี" : "Year"}
              </Label>
              <Select
                value={filterYear || "__all__"}
                onValueChange={(v) => setFilterYear(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder={language === "th" ? "ทั้งหมด" : "All"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {language === "th" ? "ทั้งหมด" : "All"}
                  </SelectItem>
                  {uniqueYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-primary">
                <FileText className="h-4 w-4" />
                {language === "th" ? "ข้อมูลทั้งหมด" : "Total Records"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{totalRecords}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "th" ? "รายการ" : "entries"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/20 to-secondary/5 border-secondary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {language === "th" ? "ส่งแล้ว" : "Submitted"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{submittedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {completionRate}% {language === "th" ? "ของทั้งหมด" : "of total"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {language === "th" ? "ตัวชี้วัด" : "Metrics"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "th" ? "ตัวชี้วัดที่ใช้งาน" : "active metrics"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {language === "th" ? "สถานที่" : "Sites"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{filteredSites.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "th" ? "สถานที่ที่บันทึก" : "reporting sites"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {language === "th" ? "สถานะข้อมูล" : "Data Status"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  {language === "th" ? "ไม่มีข้อมูล" : "No data"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dimension Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Leaf className="h-5 w-5 text-primary" />
                {language === "th" ? "ข้อมูลตามมิติ ESG" : "Data by ESG Dimension"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dimensionData.some((d) => d.total > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dimensionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
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
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  {language === "th" ? "ไม่มีข้อมูล" : "No data"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {language === "th"
                  ? `แนวโน้มรายเดือน ${selectedYear || ""}`
                  : `Monthly Trend ${selectedYear || ""}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="submitted"
                      name={language === "th" ? "ส่งแล้ว" : "Submitted"}
                      stroke="hsl(var(--primary))"
                      fill="url(#colorSubmitted)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="draft"
                      name={language === "th" ? "ร่าง" : "Draft"}
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  {language === "th" ? "ไม่มีข้อมูล" : "No data"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Site Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {language === "th" ? "ข้อมูลตามสถานที่" : "Data by Site"}
              </CardTitle>
              <CardDescription>
                {language === "th" ? "10 อันดับแรก" : "Top 10"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {siteData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={siteData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      className="text-xs"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border rounded-lg p-2 shadow-lg">
                              <p className="font-medium text-sm">{data.fullName}</p>
                              <p className="text-xs text-muted-foreground">
                                {language === "th" ? "ส่งแล้ว" : "Submitted"}: {data.submitted}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {language === "th" ? "ร่าง" : "Draft"}: {data.draft}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="submitted"
                      name={language === "th" ? "ส่งแล้ว" : "Submitted"}
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="draft"
                      name={language === "th" ? "ร่าง" : "Draft"}
                      fill="hsl(var(--muted-foreground))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  {language === "th" ? "ไม่มีข้อมูล" : "No data"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Metrics Table */}
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
                {topMetrics.map((metric, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm" title={metric.fullName}>
                          {metric.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">{metric.dimension}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">{metric.count} {language === "th" ? "รายการ" : "records"}</Badge>
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
      </div>
    </MainLayout>
  );
}
