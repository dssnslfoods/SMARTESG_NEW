import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Edit, Trash2, Save, FileText, Building2, MapPin, Calendar, BarChart3 } from "lucide-react";

interface Site {
  site_id: string;
  site_name: string;
  company_id: string;
  location: string | null;
}

interface Company {
  company_id: string;
  company_name: string;
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
  data_source: string | null;
  remark: string | null;
  submitted_by: string | null;
  created_at: string;
}

interface FormData {
  value_id: string;
  site_id: string;
  period_id: string;
  metric_id: string;
  value: number;
  data_source: string;
  remark: string;
  status: string;
}

export default function DataEntry() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useAuditLog();

  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [dimensions, setDimensions] = useState<EsgDimension[]>([]);
  const [themes, setThemes] = useState<EsgTheme[]>([]);
  const [metrics, setMetrics] = useState<EsgMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<MetricValue | null>(null);

  // Filter states
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [filterDimension, setFilterDimension] = useState<string>("");
  const [filterTheme, setFilterTheme] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Form filter states
  const [formDimension, setFormDimension] = useState<string>("");
  const [formTheme, setFormTheme] = useState<string>("");

  const [formData, setFormData] = useState<FormData>({
    value_id: '',
    site_id: '',
    period_id: '',
    metric_id: '',
    value: 0,
    data_source: '',
    remark: '',
    status: 'draft',
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        { data: sitesData },
        { data: companiesData },
        { data: periodsData },
        { data: dimensionsData },
        { data: themesData },
        { data: metricsData },
        { data: valuesData },
      ] = await Promise.all([
        supabase.from('site').select('*').order('site_name'),
        supabase.from('company').select('*').order('company_name'),
        supabase.from('reporting_period').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('esg_dimension').select('*').order('dimension_name'),
        supabase.from('esg_theme').select('*').order('theme_name'),
        supabase.from('esg_metric').select('*').order('metric_name'),
        supabase.from('metric_value').select('*').order('created_at', { ascending: false }),
      ]);

      setSites(sitesData || []);
      setCompanies(companiesData || []);
      setPeriods(periodsData || []);
      setDimensions(dimensionsData || []);
      setThemes(themesData || []);
      setMetrics(metricsData || []);
      setMetricValues(valuesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateValueId = () => {
    return `VAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleCreate = () => {
    setEditingValue(null);
    setFormDimension('');
    setFormTheme('');
    setFormData({
      value_id: generateValueId(),
      site_id: '',
      period_id: '',
      metric_id: '',
      value: 0,
      data_source: '',
      remark: '',
      status: 'draft',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (value: MetricValue) => {
    const metric = metrics.find(m => m.metric_id === value.metric_id);
    const theme = themes.find(t => t.theme_id === metric?.theme_id);
    
    setEditingValue(value);
    setFormDimension(theme?.dimension_id || '');
    setFormTheme(metric?.theme_id || '');
    setFormData({
      value_id: value.value_id,
      site_id: value.site_id,
      period_id: value.period_id,
      metric_id: value.metric_id,
      value: value.value,
      data_source: value.data_source || '',
      remark: value.remark || '',
      status: value.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (valueId: string) => {
    if (!confirm(language === 'th' ? 'ยืนยันการลบข้อมูล?' : 'Confirm delete?')) return;

    const valueToDelete = metricValues.find(v => v.value_id === valueId);
    const { error } = await supabase.from('metric_value').delete().eq('value_id', valueId);

    if (error) {
      toast({
        title: language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await logActivity({
        action: 'DELETE',
        entityType: 'metric_value',
        entityId: valueId,
        beforeData: valueToDelete,
      });
      toast({
        title: language === 'th' ? 'สำเร็จ' : 'Success',
        description: language === 'th' ? 'ลบข้อมูลสำเร็จ' : 'Data deleted successfully',
      });
      fetchAllData();
    }
  };

  const handleSubmit = async () => {
    if (!formData.site_id || !formData.period_id || !formData.metric_id) {
      toast({
        title: language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    const dataToSave = {
      value_id: formData.value_id,
      site_id: formData.site_id,
      period_id: formData.period_id,
      metric_id: formData.metric_id,
      value: formData.value,
      data_source: formData.data_source || null,
      remark: formData.remark || null,
      status: formData.status,
      submitted_by: user?.id,
    };

    let error;
    if (editingValue) {
      const { error: updateError } = await supabase
        .from('metric_value')
        .update(dataToSave)
        .eq('value_id', editingValue.value_id);
      error = updateError;
      
      if (!updateError) {
        await logActivity({
          action: 'UPDATE',
          entityType: 'metric_value',
          entityId: editingValue.value_id,
          beforeData: editingValue,
          afterData: dataToSave,
        });
      }
    } else {
      const { error: insertError } = await supabase.from('metric_value').insert(dataToSave);
      error = insertError;
      
      if (!insertError) {
        await logActivity({
          action: 'CREATE',
          entityType: 'metric_value',
          entityId: formData.value_id,
          afterData: dataToSave,
        });
      }
    }

    if (error) {
      toast({
        title: language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: language === 'th' ? 'สำเร็จ' : 'Success',
        description: editingValue
          ? (language === 'th' ? 'อัปเดตข้อมูลสำเร็จ' : 'Data updated successfully')
          : (language === 'th' ? 'บันทึกข้อมูลสำเร็จ' : 'Data saved successfully'),
      });
      setIsDialogOpen(false);
      fetchAllData();
    }
  };

  // Filtered data
  const filteredSites = filterCompany
    ? sites.filter(s => s.company_id === filterCompany)
    : sites;

  const filteredThemes = filterDimension
    ? themes.filter(t => t.dimension_id === filterDimension)
    : themes;

  const filteredMetrics = filterTheme
    ? metrics.filter(m => m.theme_id === filterTheme)
    : metrics;

  // Form filtered data
  const formFilteredThemes = formDimension
    ? themes.filter(t => t.dimension_id === formDimension)
    : themes;

  const formFilteredMetrics = formTheme
    ? metrics.filter(m => m.theme_id === formTheme)
    : metrics;

  // Filter metric values
  const filteredValues = metricValues.filter(v => {
    if (filterSite && v.site_id !== filterSite) return false;
    if (filterPeriod && v.period_id !== filterPeriod) return false;
    if (filterStatus && v.status !== filterStatus) return false;
    if (filterTheme) {
      const metric = metrics.find(m => m.metric_id === v.metric_id);
      if (metric?.theme_id !== filterTheme) return false;
    }
    if (filterDimension) {
      const metric = metrics.find(m => m.metric_id === v.metric_id);
      const theme = themes.find(t => t.theme_id === metric?.theme_id);
      if (theme?.dimension_id !== filterDimension) return false;
    }
    return true;
  });

  const getDisplayName = (id: string, type: 'site' | 'period' | 'metric' | 'dimension' | 'theme' | 'company') => {
    switch (type) {
      case 'site':
        return sites.find(s => s.site_id === id)?.site_name || id;
      case 'period':
        const period = periods.find(p => p.period_id === id);
        return period ? `${period.month_name} ${period.year}` : id;
      case 'metric':
        const metric = metrics.find(m => m.metric_id === id);
        return metric ? `${metric.metric_name}${metric.unit ? ` (${metric.unit})` : ''}` : id;
      case 'dimension':
        return dimensions.find(d => d.dimension_id === id)?.dimension_name || id;
      case 'theme':
        return themes.find(t => t.theme_id === id)?.theme_name || id;
      case 'company':
        return companies.find(c => c.company_id === id)?.company_name || id;
      default:
        return id;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'submitted':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { th: string; en: string }> = {
      draft: { th: 'ร่าง', en: 'Draft' },
      submitted: { th: 'ส่งแล้ว', en: 'Submitted' },
    };
    return labels[status]?.[language === 'th' ? 'th' : 'en'] || status;
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              {language === 'th' ? 'บันทึกข้อมูล ESG' : 'ESG Data Entry'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'th' ? 'บันทึกและจัดการข้อมูลตัวชี้วัด ESG' : 'Record and manage ESG metric values'}
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {language === 'th' ? 'เพิ่มข้อมูล' : 'Add Data'}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {language === 'th' ? 'ข้อมูลทั้งหมด' : 'Total Records'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metricValues.length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-muted-foreground">
            <CardHeader className="pb-2">
              <CardDescription>{language === 'th' ? 'ร่าง' : 'Draft'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metricValues.filter(v => v.status === 'draft').length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-secondary">
            <CardHeader className="pb-2">
              <CardDescription>{language === 'th' ? 'ส่งแล้ว' : 'Submitted'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metricValues.filter(v => v.status === 'submitted').length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {language === 'th' ? 'ตัวกรอง' : 'Filters'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {language === 'th' ? 'บริษัท' : 'Company'}
                </Label>
                <Select value={filterCompany || "__all__"} onValueChange={(v) => { setFilterCompany(v === "__all__" ? "" : v); setFilterSite(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.company_id} value={company.company_id}>
                        {company.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {language === 'th' ? 'สถานที่' : 'Site'}
                </Label>
                <Select value={filterSite || "__all__"} onValueChange={(v) => setFilterSite(v === "__all__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                    {filteredSites.map((site) => (
                      <SelectItem key={site.site_id} value={site.site_id}>
                        {site.site_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {language === 'th' ? 'รอบระยะเวลา' : 'Period'}
                </Label>
                <Select value={filterPeriod || "__all__"} onValueChange={(v) => setFilterPeriod(v === "__all__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                    {periods.map((period) => (
                      <SelectItem key={period.period_id} value={period.period_id}>
                        {period.month_name} {period.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'th' ? 'มิติ ESG' : 'Dimension'}</Label>
                <Select value={filterDimension || "__all__"} onValueChange={(v) => { setFilterDimension(v === "__all__" ? "" : v); setFilterTheme(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                    {dimensions.map((dim) => (
                      <SelectItem key={dim.dimension_id} value={dim.dimension_id}>
                        {dim.dimension_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'th' ? 'หัวข้อ ESG' : 'Theme'}</Label>
                <Select value={filterTheme || "__all__"} onValueChange={(v) => setFilterTheme(v === "__all__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                    {filteredThemes.map((theme) => (
                      <SelectItem key={theme.theme_id} value={theme.theme_id}>
                        {theme.theme_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'th' ? 'สถานะ' : 'Status'}</Label>
                <Select value={filterStatus || "__all__"} onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                    <SelectItem value="draft">{language === 'th' ? 'ร่าง' : 'Draft'}</SelectItem>
                    <SelectItem value="submitted">{language === 'th' ? 'ส่งแล้ว' : 'Submitted'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {language === 'th' ? 'รายการข้อมูล' : 'Data Records'}
              <Badge variant="secondary" className="ml-2">
                {filteredValues.length} {language === 'th' ? 'รายการ' : 'records'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
              </div>
            ) : filteredValues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === 'th' ? 'ไม่พบข้อมูล' : 'No data found'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'th' ? 'สถานที่' : 'Site'}</TableHead>
                      <TableHead>{language === 'th' ? 'รอบระยะเวลา' : 'Period'}</TableHead>
                      <TableHead>{language === 'th' ? 'ตัวชี้วัด' : 'Metric'}</TableHead>
                      <TableHead className="text-right">{language === 'th' ? 'ค่า' : 'Value'}</TableHead>
                      <TableHead>{language === 'th' ? 'สถานะ' : 'Status'}</TableHead>
                      <TableHead className="text-right">{language === 'th' ? 'จัดการ' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredValues.map((value) => (
                      <TableRow key={value.value_id}>
                        <TableCell className="font-medium">
                          {getDisplayName(value.site_id, 'site')}
                        </TableCell>
                        <TableCell>{getDisplayName(value.period_id, 'period')}</TableCell>
                        <TableCell>{getDisplayName(value.metric_id, 'metric')}</TableCell>
                        <TableCell className="text-right font-mono">
                          {value.value.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(value.status)}>
                            {getStatusLabel(value.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(value)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(value.value_id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingValue
                  ? (language === 'th' ? 'แก้ไขข้อมูล' : 'Edit Data')
                  : (language === 'th' ? 'เพิ่มข้อมูลใหม่' : 'Add New Data')}
              </DialogTitle>
              <DialogDescription>
                {language === 'th'
                  ? 'กรอกข้อมูลตัวชี้วัด ESG ให้ครบถ้วน'
                  : 'Fill in the ESG metric data completely'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'th' ? 'สถานที่' : 'Site'} *</Label>
                  <Select
                    value={formData.site_id}
                    onValueChange={(v) => setFormData({ ...formData, site_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'th' ? 'เลือกสถานที่' : 'Select site'} />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.site_id} value={site.site_id}>
                          {site.site_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'th' ? 'รอบระยะเวลา' : 'Period'} *</Label>
                  <Select
                    value={formData.period_id}
                    onValueChange={(v) => setFormData({ ...formData, period_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'th' ? 'เลือกรอบระยะเวลา' : 'Select period'} />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((period) => (
                        <SelectItem key={period.period_id} value={period.period_id}>
                          {period.month_name} {period.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'th' ? 'มิติ ESG' : 'Dimension'}</Label>
                  <Select
                    value={formDimension}
                    onValueChange={(v) => { setFormDimension(v); setFormTheme(''); setFormData({ ...formData, metric_id: '' }); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'th' ? 'เลือกมิติ' : 'Select dimension'} />
                    </SelectTrigger>
                    <SelectContent>
                      {dimensions.map((dim) => (
                        <SelectItem key={dim.dimension_id} value={dim.dimension_id}>
                          {dim.dimension_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'th' ? 'หัวข้อ ESG' : 'Theme'}</Label>
                  <Select
                    value={formTheme}
                    onValueChange={(v) => { setFormTheme(v); setFormData({ ...formData, metric_id: '' }); }}
                    disabled={!formDimension}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'th' ? 'เลือกหัวข้อ' : 'Select theme'} />
                    </SelectTrigger>
                    <SelectContent>
                      {formFilteredThemes.map((theme) => (
                        <SelectItem key={theme.theme_id} value={theme.theme_id}>
                          {theme.theme_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'ตัวชี้วัด' : 'Metric'} *</Label>
                <Select
                  value={formData.metric_id}
                  onValueChange={(v) => setFormData({ ...formData, metric_id: v })}
                  disabled={!formTheme}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกตัวชี้วัด' : 'Select metric'} />
                  </SelectTrigger>
                  <SelectContent>
                    {formFilteredMetrics.map((metric) => (
                      <SelectItem key={metric.metric_id} value={metric.metric_id}>
                        {metric.metric_name} {metric.unit ? `(${metric.unit})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'th' ? 'ค่า' : 'Value'} *</Label>
                  <Input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'th' ? 'สถานะ' : 'Status'}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{language === 'th' ? 'ร่าง' : 'Draft'}</SelectItem>
                      <SelectItem value="submitted">{language === 'th' ? 'ส่ง' : 'Submit'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'แหล่งข้อมูล' : 'Data Source'}</Label>
                <Input
                  value={formData.data_source}
                  onChange={(e) => setFormData({ ...formData, data_source: e.target.value })}
                  placeholder={language === 'th' ? 'ระบุแหล่งที่มาของข้อมูล' : 'Specify data source'}
                />
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'หมายเหตุ' : 'Remark'}</Label>
                <Textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  placeholder={language === 'th' ? 'หมายเหตุเพิ่มเติม' : 'Additional notes'}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </Button>
              <Button onClick={handleSubmit} className="gap-2">
                <Save className="h-4 w-4" />
                {language === 'th' ? 'บันทึก' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
