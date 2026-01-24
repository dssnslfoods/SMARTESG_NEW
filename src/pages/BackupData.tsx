import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Database, Shield, Calendar } from 'lucide-react';
import { exportToExcel, generateExportFilename, ExportMetadata } from '@/lib/excelExport';

// Lookup types for human-readable mapping
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

interface Dimension {
  dimension_id: string;
  dimension_name: string;
}

interface Theme {
  theme_id: string;
  theme_name: string;
  dimension_id: string;
}

interface Metric {
  metric_id: string;
  metric_name: string;
  theme_id: string;
  unit: string | null;
}

interface MetricValue {
  value_id: string;
  site_id: string;
  period_id: string;
  metric_id: string;
  value: number;
  status: string;
  data_source: string | null;
  remark: string | null;
}

// Human-readable export row (exactly 10 columns)
interface HumanReadableRow {
  company: string;
  site: string;
  period: string;
  dimension: string;
  theme: string;
  metric: string;
  value: number;
  unit: string;
  data_source: string;
  remark: string;
}

export default function BackupData() {
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Lookup data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  
  // Filter state
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterSite, setFilterSite] = useState<string>('all');
  const [startPeriod, setStartPeriod] = useState<string>('');
  const [endPeriod, setEndPeriod] = useState<string>('');
  const [filterDimension, setFilterDimension] = useState<string>('all');
  const [filterTheme, setFilterTheme] = useState<string>('all');
  const [filterMetric, setFilterMetric] = useState<string>('all');

  // Additional access control - only admin
  if (role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <Shield className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-semibold">
                  {language === 'th' ? 'ไม่มีสิทธิ์เข้าถึง' : 'Access Denied'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'th' 
                    ? 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงหน้านี้ได้' 
                    : 'Only administrators can access this page'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  useEffect(() => {
    fetchLookupData();
  }, []);

  // Fetch all lookup tables for ID-to-name mapping
  const fetchLookupData = async () => {
    try {
      const [
        companiesRes,
        sitesRes,
        periodsRes,
        dimensionsRes,
        themesRes,
        metricsRes,
      ] = await Promise.all([
        supabase.from('company').select('company_id, company_name').order('company_name'),
        supabase.from('site').select('site_id, site_name, company_id').order('site_name'),
        supabase.from('reporting_period').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('esg_dimension').select('dimension_id, dimension_name').order('dimension_name'),
        supabase.from('esg_theme').select('theme_id, theme_name, dimension_id').order('theme_name'),
        supabase.from('esg_metric').select('metric_id, metric_name, theme_id, unit').order('metric_name'),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (sitesRes.error) throw sitesRes.error;
      if (periodsRes.error) throw periodsRes.error;
      if (dimensionsRes.error) throw dimensionsRes.error;
      if (themesRes.error) throw themesRes.error;
      if (metricsRes.error) throw metricsRes.error;

      setCompanies(companiesRes.data || []);
      setSites(sitesRes.data || []);
      setPeriods(periodsRes.data || []);
      setDimensions(dimensionsRes.data || []);
      setThemes(themesRes.data || []);
      setMetrics(metricsRes.data || []);
    } catch (error) {
      console.error('Error fetching lookup data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get filtered sites based on selected company
  const filteredSites = filterCompany === 'all' 
    ? sites 
    : sites.filter(s => s.company_id === filterCompany);

  // Get filtered themes based on selected dimension
  const filteredThemes = filterDimension === 'all'
    ? themes
    : themes.filter(t => t.dimension_id === filterDimension);

  // Get filtered metrics based on selected theme
  const filteredMetrics = filterTheme === 'all'
    ? metrics
    : metrics.filter(m => m.theme_id === filterTheme);

  // NEW isolated read-only fetch function for backup export
  const fetchTransactionsForBackup = async (): Promise<MetricValue[]> => {
    const PAGE_SIZE = 1000;
    let allValues: MetricValue[] = [];
    let from = 0;
    let hasMore = true;

    // Build metric IDs filter based on dimension/theme/metric selection
    let metricIdsToFilter: string[] | null = null;
    
    if (filterMetric !== 'all') {
      metricIdsToFilter = [filterMetric];
    } else if (filterTheme !== 'all') {
      metricIdsToFilter = metrics.filter(m => m.theme_id === filterTheme).map(m => m.metric_id);
    } else if (filterDimension !== 'all') {
      const themeIds = themes.filter(t => t.dimension_id === filterDimension).map(t => t.theme_id);
      metricIdsToFilter = metrics.filter(m => themeIds.includes(m.theme_id)).map(m => m.metric_id);
    }

    // Build site IDs filter based on company/site selection
    let siteIdsToFilter: string[] | null = null;
    
    if (filterSite !== 'all') {
      siteIdsToFilter = [filterSite];
    } else if (filterCompany !== 'all') {
      siteIdsToFilter = sites.filter(s => s.company_id === filterCompany).map(s => s.site_id);
    }

    while (hasMore) {
      let query = supabase
        .from('metric_value')
        .select('value_id, site_id, period_id, metric_id, value, status, data_source, remark')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      // Apply site filter
      if (siteIdsToFilter && siteIdsToFilter.length > 0) {
        query = query.in('site_id', siteIdsToFilter);
      }

      // Apply metric filter
      if (metricIdsToFilter && metricIdsToFilter.length > 0) {
        query = query.in('metric_id', metricIdsToFilter);
      }

      // Apply period range filter
      if (startPeriod && startPeriod !== 'all_start' && endPeriod && endPeriod !== 'all_end') {
        const startP = periods.find(p => p.period_id === startPeriod);
        const endP = periods.find(p => p.period_id === endPeriod);
        
        if (startP && endP) {
          const periodsInRange = periods.filter(p => {
            const periodValue = p.year * 100 + p.month;
            const startValue = startP.year * 100 + startP.month;
            const endValue = endP.year * 100 + endP.month;
            return periodValue >= Math.min(startValue, endValue) && periodValue <= Math.max(startValue, endValue);
          });

          if (periodsInRange.length > 0) {
            query = query.in('period_id', periodsInRange.map(p => p.period_id));
          }
        }
      } else if (startPeriod && startPeriod !== 'all_start') {
        query = query.eq('period_id', startPeriod);
      } else if (endPeriod && endPeriod !== 'all_end') {
        query = query.eq('period_id', endPeriod);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

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

  // Map IDs to human-readable names
  const mapToHumanReadable = (data: MetricValue[]): HumanReadableRow[] => {
    // Build lookup maps for O(1) access
    const companyMap = new Map(companies.map(c => [c.company_id, c.company_name]));
    const siteMap = new Map(sites.map(s => [s.site_id, { name: s.site_name, company_id: s.company_id }]));
    const periodMap = new Map(periods.map(p => [p.period_id, `${p.month_name} ${p.year}`]));
    const dimensionMap = new Map(dimensions.map(d => [d.dimension_id, d.dimension_name]));
    const themeMap = new Map(themes.map(t => [t.theme_id, { name: t.theme_name, dimension_id: t.dimension_id }]));
    const metricMap = new Map(metrics.map(m => [m.metric_id, { name: m.metric_name, theme_id: m.theme_id, unit: m.unit }]));

    return data.map(row => {
      const siteInfo = siteMap.get(row.site_id);
      const metricInfo = metricMap.get(row.metric_id);
      const themeInfo = metricInfo ? themeMap.get(metricInfo.theme_id) : null;
      const dimensionName = themeInfo ? dimensionMap.get(themeInfo.dimension_id) : null;
      const companyName = siteInfo ? companyMap.get(siteInfo.company_id) : null;

      return {
        company: companyName || '',
        site: siteInfo?.name || '',
        period: periodMap.get(row.period_id) || '',
        dimension: dimensionName || '',
        theme: themeInfo?.name || '',
        metric: metricInfo?.name || '',
        value: row.value,
        unit: metricInfo?.unit || '',
        data_source: row.data_source || '',
        remark: row.remark || '',
      };
    });
  };

  const handleExportTransactions = async () => {
    setExporting(true);

    try {
      const rawData = await fetchTransactionsForBackup();

      if (!rawData || rawData.length === 0) {
        toast({
          variant: 'destructive',
          title: language === 'th' ? 'ไม่มีข้อมูล' : 'No Data',
          description: language === 'th' ? 'ไม่มีข้อมูลให้ส่งออก' : 'No data to export',
        });
        setExporting(false);
        return;
      }

      // Map to human-readable format
      const humanReadableData = mapToHumanReadable(rawData);

      // Build applied filters text
      const appliedFilters: Record<string, string> = {};
      
      if (filterCompany !== 'all') {
        const company = companies.find(c => c.company_id === filterCompany);
        appliedFilters['Company'] = company?.company_name || filterCompany;
      } else {
        appliedFilters['Company'] = 'All';
      }
      
      if (filterSite !== 'all') {
        const site = sites.find(s => s.site_id === filterSite);
        appliedFilters['Site'] = site?.site_name || filterSite;
      } else {
        appliedFilters['Site'] = 'All';
      }
      
      if (startPeriod && startPeriod !== 'all_start') {
        const period = periods.find(p => p.period_id === startPeriod);
        appliedFilters['Start Period'] = period ? `${period.month_name} ${period.year}` : startPeriod;
      } else {
        appliedFilters['Start Period'] = 'All';
      }
      
      if (endPeriod && endPeriod !== 'all_end') {
        const period = periods.find(p => p.period_id === endPeriod);
        appliedFilters['End Period'] = period ? `${period.month_name} ${period.year}` : endPeriod;
      } else {
        appliedFilters['End Period'] = 'All';
      }
      
      if (filterDimension !== 'all') {
        const dimension = dimensions.find(d => d.dimension_id === filterDimension);
        appliedFilters['Dimension'] = dimension?.dimension_name || filterDimension;
      } else {
        appliedFilters['Dimension'] = 'All';
      }
      
      if (filterTheme !== 'all') {
        const theme = themes.find(t => t.theme_id === filterTheme);
        appliedFilters['Theme'] = theme?.theme_name || filterTheme;
      } else {
        appliedFilters['Theme'] = 'All';
      }
      
      if (filterMetric !== 'all') {
        const metric = metrics.find(m => m.metric_id === filterMetric);
        appliedFilters['Metric'] = metric?.metric_name || filterMetric;
      } else {
        appliedFilters['Metric'] = 'All';
      }

      const metadata: ExportMetadata = {
        exported_at: new Date().toISOString(),
        exported_by_id: user?.id || null,
        exported_by_email: user?.email || null,
        source_page: 'Backup Data',
        applied_filters: appliedFilters,
        total_rows: humanReadableData.length,
        note: 'Human-readable backup export (no internal IDs)',
      };

      const filename = generateExportFilename('backup_kpi');

      // Exactly 10 columns in specified order
      const columnOrder = [
        'company',
        'site',
        'period',
        'dimension',
        'theme',
        'metric',
        'value',
        'unit',
        'data_source',
        'remark',
      ];

      const columnLabels: Record<string, string> = {
        company: 'Company',
        site: 'Site',
        period: 'Period',
        dimension: 'Dimension',
        theme: 'Theme',
        metric: 'Metric',
        value: 'Value',
        unit: 'Unit',
        data_source: 'Data Source',
        remark: 'Remark',
      };

      exportToExcel({
        data: humanReadableData as unknown as Record<string, unknown>[],
        filename,
        sheetName: 'KPI Data',
        metadata,
        columnOrder,
        columnLabels,
      });

      toast({
        title: language === 'th' ? 'ส่งออกสำเร็จ' : 'Export Successful',
        description: language === 'th'
          ? `ส่งออก ${humanReadableData.length} รายการไปยัง ${filename}`
          : `Exported ${humanReadableData.length} rows to ${filename}`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: language === 'th' ? 'เกิดข้อผิดพลาด' : 'Export Failed',
        description: error.message || (language === 'th' ? 'ไม่สามารถส่งออกได้' : 'Unable to export data'),
      });
    } finally {
      setExporting(false);
    }
  };

  // Reset dependent filters when parent changes
  const handleCompanyChange = (value: string) => {
    setFilterCompany(value);
    setFilterSite('all');
  };

  const handleDimensionChange = (value: string) => {
    setFilterDimension(value);
    setFilterTheme('all');
    setFilterMetric('all');
  };

  const handleThemeChange = (value: string) => {
    setFilterTheme(value);
    setFilterMetric('all');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              {language === 'th' ? 'สำรองข้อมูล' : 'Backup Data'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'th'
                ? 'ส่งออกข้อมูล KPI ทั้งหมดเป็นไฟล์ Excel แบบอ่านได้ง่าย (Human-Readable)'
                : 'Export all KPI data to human-readable Excel file'}
            </p>
          </div>
        </div>

        {/* Transaction Export Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {language === 'th' ? 'ส่งออกข้อมูล KPI' : 'Export KPI Data'}
            </CardTitle>
            <CardDescription>
              {language === 'th'
                ? 'เลือกตัวกรองที่ต้องการแล้วกดส่งออก - ข้อมูลจะแสดงเป็นชื่อที่อ่านได้ ไม่ใช่ ID'
                : 'Select filters and export - data will show readable names, not IDs'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filters - Row 1: Company & Site */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'th' ? 'บริษัท' : 'Company'}</Label>
                <Select value={filterCompany} onValueChange={handleCompanyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกบริษัท' : 'Select company'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === 'th' ? 'ทั้งหมด' : 'All'}
                    </SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.company_id} value={c.company_id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'ไซต์' : 'Site'}</Label>
                <Select value={filterSite} onValueChange={setFilterSite}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกไซต์' : 'Select site'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === 'th' ? 'ทั้งหมด' : 'All'}
                    </SelectItem>
                    {filteredSites.map((s) => (
                      <SelectItem key={s.site_id} value={s.site_id}>
                        {s.site_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filters - Row 2: Period Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'th' ? 'เริ่มต้น (Period)' : 'Start Period'}</Label>
                <Select value={startPeriod} onValueChange={setStartPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกเดือนเริ่มต้น' : 'Select start period'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_start">
                      {language === 'th' ? 'ทั้งหมด (ไม่จำกัด)' : 'All (No limit)'}
                    </SelectItem>
                    {periods.map((p) => (
                      <SelectItem key={p.period_id} value={p.period_id}>
                        {p.month_name} {p.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'สิ้นสุด (Period)' : 'End Period'}</Label>
                <Select value={endPeriod} onValueChange={setEndPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกเดือนสิ้นสุด' : 'Select end period'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_end">
                      {language === 'th' ? 'ทั้งหมด (ไม่จำกัด)' : 'All (No limit)'}
                    </SelectItem>
                    {periods.map((p) => (
                      <SelectItem key={p.period_id} value={p.period_id}>
                        {p.month_name} {p.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filters - Row 3: Dimension, Theme, Metric */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === 'th' ? 'มิติ (Dimension)' : 'Dimension'}</Label>
                <Select value={filterDimension} onValueChange={handleDimensionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกมิติ' : 'Select dimension'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === 'th' ? 'ทั้งหมด' : 'All'}
                    </SelectItem>
                    {dimensions.map((d) => (
                      <SelectItem key={d.dimension_id} value={d.dimension_id}>
                        {d.dimension_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'ธีม (Theme)' : 'Theme'}</Label>
                <Select value={filterTheme} onValueChange={handleThemeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกธีม' : 'Select theme'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === 'th' ? 'ทั้งหมด' : 'All'}
                    </SelectItem>
                    {filteredThemes.map((t) => (
                      <SelectItem key={t.theme_id} value={t.theme_id}>
                        {t.theme_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'ตัวชี้วัด (Metric)' : 'Metric'}</Label>
                <Select value={filterMetric} onValueChange={setFilterMetric}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกตัวชี้วัด' : 'Select metric'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === 'th' ? 'ทั้งหมด' : 'All'}
                    </SelectItem>
                    {filteredMetrics.map((m) => (
                      <SelectItem key={m.metric_id} value={m.metric_id}>
                        {m.metric_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleExportTransactions}
                disabled={exporting || loading}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {language === 'th' ? 'Export KPI Excel' : 'Export KPI Excel'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  {language === 'th' ? 'ข้อมูลสำคัญเกี่ยวกับการสำรองข้อมูล' : 'Important Backup Information'}
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 list-disc list-inside space-y-1">
                  <li>
                    {language === 'th'
                      ? 'ข้อมูลที่ส่งออกจะแสดงเป็นชื่อที่อ่านได้ ไม่ใช่ ID ภายในระบบ'
                      : 'Exported data shows readable names, not internal IDs'}
                  </li>
                  <li>
                    {language === 'th'
                      ? 'ไฟล์ Excel มี 10 คอลัมน์: Company, Site, Period, Dimension, Theme, Metric, Value, Unit, Data Source, Remark'
                      : 'Excel contains 10 columns: Company, Site, Period, Dimension, Theme, Metric, Value, Unit, Data Source, Remark'}
                  </li>
                  <li>
                    {language === 'th'
                      ? 'การส่งออกจะส่งเฉพาะข้อมูลที่คุณมีสิทธิ์เข้าถึงตาม RLS policies'
                      : 'Export only includes data you have access to per RLS policies'}
                  </li>
                  <li>
                    {language === 'th'
                      ? 'การดำเนินการนี้เป็นแบบ Read-Only ไม่มีการเปลี่ยนแปลงข้อมูลในระบบ'
                      : 'This operation is Read-Only - no data modifications occur'}
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
