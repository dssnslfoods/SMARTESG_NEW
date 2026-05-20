import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  History, Eye, Search, Filter, RotateCcw, AlertTriangle,
  ArrowRight, CheckCircle2, XCircle, Info,
} from "lucide-react";
import { format } from "date-fns";
import { th as thLocale, enUS } from "date-fns/locale";
import { PlanGate } from "@/components/plan/PlanGate";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface AuditLogEntry {
  log_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

interface UserProfile  { user_id: string; full_name: string | null }
interface Site         { site_id: string; site_name: string }
interface Company      { company_id: string; company_name: string }
interface Period       { period_id: string; period_name: string; year: number; month: number }
interface EsgMetric    { metric_id: string; metric_name: string; unit: string | null }
interface EsgTheme     { theme_id: string; theme_name: string }
interface EsgDimension { dimension_id: string; dimension_name: string }

// ─── Field display config per entity_type ─────────────────────────────────────

const METRIC_VALUE_FIELDS: { key: string; labelTh: string; labelEn: string }[] = [
  { key: 'value',        labelTh: 'ค่า',              labelEn: 'Value' },
  { key: 'status',       labelTh: 'สถานะ',            labelEn: 'Status' },
  { key: 'data_source',  labelTh: 'แหล่งข้อมูล',      labelEn: 'Data Source' },
  { key: 'remark',       labelTh: 'หมายเหตุ',         labelEn: 'Remark' },
];

const GENERIC_SKIP_KEYS = new Set([
  'tenant_id', 'submitted_by', 'created_at', 'updated_at',
  'value_id', 'company_id', 'site_id', 'period_id', 'metric_id',
  'theme_id', 'dimension_id', 'user_id',
]);

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuditLog() {
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useAuditLog();
  const th = language === 'th';

  const [logs,     setLogs]     = useState<AuditLogEntry[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailOpen,  setDetailOpen]  = useState(false);

  // Reference data for label resolution
  const [sites,      setSites]      = useState<Site[]>([]);
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [periods,    setPeriods]    = useState<Period[]>([]);
  const [metrics,    setMetrics]    = useState<EsgMetric[]>([]);
  const [themes,     setThemes]     = useState<EsgTheme[]>([]);
  const [dimensions, setDimensions] = useState<EsgDimension[]>([]);

  // Restore state
  const [restoreConfirmOpen,    setRestoreConfirmOpen]    = useState(false);
  const [restoreConflictOpen,   setRestoreConflictOpen]   = useState(false);
  const [pendingRestoreData,    setPendingRestoreData]    = useState<Record<string, unknown> | null>(null);
  const [existingConflictValue, setExistingConflictValue] = useState<Record<string, unknown> | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Filters
  const [filterAction,     setFilterAction]     = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [searchTerm,       setSearchTerm]       = useState('');

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: logsData },
        { data: profilesData },
        { data: sitesData },
        { data: companiesData },
        { data: periodsData },
        { data: metricsData },
        { data: themesData },
        { data: dimensionsData },
      ] = await Promise.all([
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('app_user_profile').select('user_id, full_name'),
        supabase.from('site').select('site_id, site_name'),
        supabase.from('company').select('company_id, company_name'),
        supabase.from('reporting_period').select('period_id, period_name, year, month'),
        supabase.from('esg_metric').select('metric_id, metric_name, unit'),
        supabase.from('esg_theme').select('theme_id, theme_name'),
        supabase.from('esg_dimension').select('dimension_id, dimension_name'),
      ]);
      setLogs(logsData || []);
      setProfiles(profilesData || []);
      setSites(sitesData || []);
      setCompanies(companiesData || []);
      setPeriods(periodsData || []);
      setMetrics(metricsData || []);
      setThemes(themesData || []);
      setDimensions(dimensionsData || []);
    } catch (err) {
      console.error('AuditLog fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Label resolvers ────────────────────────────────────────────────────────

  const getActorName = (userId: string | null) => {
    if (!userId) return th ? 'ระบบ' : 'System';
    return profiles.find(p => p.user_id === userId)?.full_name || userId.slice(0, 8) + '…';
  };

  const resolveName = (key: string, value: unknown): string => {
    if (typeof value !== 'string' || !value) return String(value ?? '-');
    if (key === 'site_id')      return sites.find(s => s.site_id === value)?.site_name || value;
    if (key === 'company_id')   return companies.find(c => c.company_id === value)?.company_name || value;
    if (key === 'period_id')    return periods.find(p => p.period_id === value)?.period_name || value;
    if (key === 'metric_id')    return metrics.find(m => m.metric_id === value)?.metric_name || value;
    if (key === 'theme_id')     return themes.find(t => t.theme_id === value)?.theme_name || value;
    if (key === 'dimension_id') return dimensions.find(d => d.dimension_id === value)?.dimension_name || value;
    if (key === 'submitted_by') return profiles.find(p => p.user_id === value)?.full_name || value.slice(0, 8) + '…';
    return String(value);
  };

  const getStatusLabel = (s: unknown) => {
    const map: Record<string, { th: string; en: string }> = {
      draft:     { th: 'ร่าง',     en: 'Draft' },
      submit:    { th: 'รออนุมัติ', en: 'Submitted' },
      submitted: { th: 'รออนุมัติ', en: 'Submitted' },
      approved:  { th: 'อนุมัติ',  en: 'Approved' },
      rejected:  { th: 'ปฏิเสธ',  en: 'Rejected' },
    };
    const k = String(s ?? '').toLowerCase();
    return map[k]?.[language] || String(s ?? '-');
  };

  // ─── Badge helpers ──────────────────────────────────────────────────────────

  const actionBadge = (action: string) => {
    const map: Record<string, { label: { th: string; en: string }; cls: string }> = {
      CREATE: { label: { th: 'สร้าง',   en: 'Create' }, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      INSERT: { label: { th: 'เพิ่ม',   en: 'Insert' }, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      UPDATE: { label: { th: 'แก้ไข',   en: 'Update' }, cls: 'bg-blue-100 text-blue-700 border-blue-200' },
      DELETE: { label: { th: 'ลบ',      en: 'Delete' }, cls: 'bg-red-100 text-red-700 border-red-200' },
      SUBMIT: { label: { th: 'ส่ง',     en: 'Submit' }, cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
      APPROVE:{ label: { th: 'อนุมัติ', en: 'Approve' },cls: 'bg-purple-100 text-purple-700 border-purple-200' },
      REJECT: { label: { th: 'ปฏิเสธ', en: 'Reject' }, cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    };
    const cfg = map[action.toUpperCase()];
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg?.cls ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
        {cfg?.label[language] ?? action}
      </span>
    );
  };

  const entityTypeLabel = (et: string) => {
    const map: Record<string, { th: string; en: string }> = {
      company:          { th: 'บริษัท',           en: 'Company' },
      site:             { th: 'สถานที่',           en: 'Site' },
      reporting_period: { th: 'รอบระยะเวลา',       en: 'Reporting Period' },
      esg_dimension:    { th: 'มิติ ESG',          en: 'ESG Dimension' },
      esg_theme:        { th: 'หัวข้อ ESG',         en: 'ESG Theme' },
      esg_metric:       { th: 'ตัวชี้วัด',          en: 'ESG Metric' },
      metric_value:     { th: 'ค่าตัวชี้วัด',       en: 'Metric Value' },
      user:             { th: 'ผู้ใช้',             en: 'User' },
      user_roles:       { th: 'สิทธิ์ผู้ใช้',       en: 'User Roles' },
    };
    return map[et]?.[language] || et;
  };

  const formatDate = (d: string) =>
    format(new Date(d), 'dd MMM yyyy HH:mm:ss', { locale: th ? thLocale : enUS });

  // ─── Filters ────────────────────────────────────────────────────────────────

  const uniqueActions      = [...new Set(logs.map(l => l.action))];
  const uniqueEntityTypes  = [...new Set(logs.map(l => l.entity_type))];

  const filteredLogs = logs.filter(log => {
    if (filterAction     && log.action      !== filterAction)     return false;
    if (filterEntityType && log.entity_type !== filterEntityType) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!getActorName(log.actor_user_id).toLowerCase().includes(s) &&
          !(log.entity_id || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // ─── Detail view helpers ─────────────────────────────────────────────────────

  /** Render a metric_value data block as a readable form */
  const renderMetricValueBlock = (
    data: Record<string, unknown>,
    label: string,
    colorCls: string,
    compareTo?: Record<string, unknown> | null
  ) => {
    const metric = metrics.find(m => m.metric_id === data.metric_id);
    return (
      <div className={`rounded-xl border p-4 space-y-3 ${colorCls}`}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>

        {/* Context (site / period / metric) — always from data */}
        <div className="grid grid-cols-1 gap-2 text-sm">
          {[
            { key: 'metric_id', labelTh: 'ตัวชี้วัด',   labelEn: 'Metric' },
            { key: 'site_id',   labelTh: 'สถานที่',      labelEn: 'Site' },
            { key: 'period_id', labelTh: 'รอบ',           labelEn: 'Period' },
          ].map(({ key, labelTh, labelEn }) => (
            <div key={key} className="flex items-start gap-2">
              <span className="w-24 shrink-0 text-gray-500">{th ? labelTh : labelEn}:</span>
              <span className="font-medium text-gray-800">{resolveName(key, data[key])}</span>
              {metric?.unit && key === 'metric_id' && (
                <span className="text-xs text-gray-400">({metric.unit})</span>
              )}
            </div>
          ))}
        </div>

        <Separator className="opacity-30" />

        {/* Editable fields with diff highlight */}
        <div className="grid grid-cols-1 gap-2 text-sm">
          {METRIC_VALUE_FIELDS.map(({ key, labelTh, labelEn }) => {
            const val     = data[key];
            const prevVal = compareTo?.[key];
            const changed = compareTo !== undefined && prevVal !== undefined && prevVal !== val;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-gray-500">{th ? labelTh : labelEn}:</span>
                <span className={`font-semibold ${changed ? 'text-emerald-700' : 'text-gray-800'}`}>
                  {key === 'status' ? getStatusLabel(val) : String(val ?? '-')}
                </span>
                {changed && (
                  <span className="ml-1 text-xs text-gray-400 line-through">
                    {key === 'status' ? getStatusLabel(prevVal) : String(prevVal ?? '-')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /** Generic form for non-metric_value entities */
  const renderGenericBlock = (data: Record<string, unknown>, label: string, colorCls: string) => {
    const displayKeys = Object.keys(data).filter(k => !GENERIC_SKIP_KEYS.has(k) && data[k] !== null && data[k] !== undefined);
    return (
      <div className={`rounded-xl border p-4 space-y-2 ${colorCls}`}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
        <div className="grid grid-cols-1 gap-1.5 text-sm">
          {displayKeys.map(key => (
            <div key={key} className="flex items-start gap-2">
              <span className="w-32 shrink-0 text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
              <span className="font-medium text-gray-800 break-all">{resolveName(key, data[key])}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Restore logic ──────────────────────────────────────────────────────────

  const canRestore = (log: AuditLogEntry) => {
    if (!log.before_data) return false;
    if (log.entity_type !== 'metric_value') return false;
    if (!['admin', 'supervisor', 'super_admin'].includes(role || '')) return false;
    return ['DELETE', 'UPDATE'].includes(log.action.toUpperCase());
  };

  const handleRestoreClick = async () => {
    if (!selectedLog?.before_data) return;
    const restoreData = selectedLog.before_data;

    // Check if a current record exists for this site/period/metric combo
    const { data: existing } = await supabase
      .from('metric_value')
      .select('*')
      .eq('site_id', restoreData.site_id as string)
      .eq('period_id', restoreData.period_id as string)
      .eq('metric_id', restoreData.metric_id as string)
      .maybeSingle();

    setPendingRestoreData(restoreData);
    if (existing) {
      setExistingConflictValue(existing as Record<string, unknown>);
      setRestoreConflictOpen(true);
    } else {
      setRestoreConfirmOpen(true);
    }
  };

  const executeRestore = async (overwrite = false) => {
    if (!pendingRestoreData || !user?.id || !selectedLog) return;
    setRestoring(true);
    setRestoreConfirmOpen(false);
    setRestoreConflictOpen(false);

    try {
      if (overwrite) {
        // UPDATE existing record to restored values
        const { error } = await supabase
          .from('metric_value')
          .update({
            value:       pendingRestoreData.value,
            status:      pendingRestoreData.status,
            data_source: pendingRestoreData.data_source,
            remark:      pendingRestoreData.remark,
            submitted_by: user.id,
          })
          .eq('site_id',   pendingRestoreData.site_id as string)
          .eq('period_id', pendingRestoreData.period_id as string)
          .eq('metric_id', pendingRestoreData.metric_id as string);

        if (error) throw error;
      } else {
        // INSERT the record back
        const { error } = await supabase.from('metric_value').insert({
          value_id:    pendingRestoreData.value_id,
          site_id:     pendingRestoreData.site_id,
          period_id:   pendingRestoreData.period_id,
          metric_id:   pendingRestoreData.metric_id,
          value:       pendingRestoreData.value,
          status:      pendingRestoreData.status,
          data_source: pendingRestoreData.data_source,
          remark:      pendingRestoreData.remark,
          submitted_by: user.id,
        });
        if (error) throw error;
      }

      await logActivity({
        action: 'UPDATE',
        entityType: 'metric_value',
        entityId: pendingRestoreData.value_id as string,
        beforeData: existingConflictValue || undefined,
        afterData: pendingRestoreData,
        description: `Restored from audit log entry ${selectedLog.log_id}`,
      } as any);

      toast({
        title: th ? 'Restore สำเร็จ' : 'Restored',
        description: th ? 'ข้อมูลถูก restore เรียบร้อยแล้ว' : 'Record has been restored successfully.',
      });
      setDetailOpen(false);
      setPendingRestoreData(null);
      setExistingConflictValue(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: th ? 'เกิดข้อผิดพลาด' : 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <PlanGate feature="audit_log">
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground">
          <History className="h-8 w-8 text-primary" />
          {th ? 'บันทึกการใช้งาน' : 'Audit Log'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {th ? 'ประวัติการดำเนินการทั้งหมดในระบบ' : 'Complete history of system activities'}
        </p>
      </div>

      {/* Filters */}
      <Card className="glass-card-solid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            {th ? 'ตัวกรอง' : 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                {th ? 'ค้นหา' : 'Search'}
              </Label>
              <Input
                placeholder={th ? 'ชื่อผู้ใช้ หรือ Entity ID...' : 'User name or Entity ID...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{th ? 'การดำเนินการ' : 'Action'}</Label>
              <Select value={filterAction || '__all__'} onValueChange={v => setFilterAction(v === '__all__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={th ? 'ทั้งหมด' : 'All'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{th ? 'ทั้งหมด' : 'All'}</SelectItem>
                  {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{th ? 'ประเภทข้อมูล' : 'Entity Type'}</Label>
              <Select value={filterEntityType || '__all__'} onValueChange={v => setFilterEntityType(v === '__all__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={th ? 'ทั้งหมด' : 'All'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{th ? 'ทั้งหมด' : 'All'}</SelectItem>
                  {uniqueEntityTypes.map(et => <SelectItem key={et} value={et}>{entityTypeLabel(et)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card-solid overflow-hidden">
        <CardHeader>
          <CardTitle className="text-foreground">
            {th ? 'รายการบันทึก' : 'Log Entries'}
            <Badge variant="secondary" className="ml-2">
              {filteredLogs.length} {th ? 'รายการ' : 'records'}
            </Badge>
          </CardTitle>
          <CardDescription>{th ? 'แสดง 500 รายการล่าสุด' : 'Showing latest 500 entries'}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">{th ? 'กำลังโหลด...' : 'Loading...'}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{th ? 'ไม่พบข้อมูล' : 'No data found'}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{th ? 'วันที่/เวลา' : 'Date/Time'}</TableHead>
                    <TableHead>{th ? 'ผู้ดำเนินการ' : 'Actor'}</TableHead>
                    <TableHead>{th ? 'การดำเนินการ' : 'Action'}</TableHead>
                    <TableHead>{th ? 'ประเภทข้อมูล' : 'Entity Type'}</TableHead>
                    <TableHead>{th ? 'รายละเอียด' : 'Summary'}</TableHead>
                    <TableHead className="text-right">{th ? 'ดูรายละเอียด' : 'Details'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => {
                    const summary = log.entity_type === 'metric_value' && (log.before_data || log.after_data)
                      ? (() => {
                          const d = log.before_data || log.after_data || {};
                          const metricName = resolveName('metric_id', d.metric_id);
                          const siteName   = resolveName('site_id',   d.site_id);
                          const periodName = resolveName('period_id', d.period_id);
                          return `${metricName} · ${siteName} · ${periodName}`;
                        })()
                      : log.entity_id || '-';
                    return (
                      <TableRow key={log.log_id}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                        <TableCell className="font-medium">{getActorName(log.actor_user_id)}</TableCell>
                        <TableCell>{actionBadge(log.action)}</TableCell>
                        <TableCell>{entityTypeLabel(log.entity_type)}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{summary}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedLog(log); setDetailOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Detail Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="glass-card-solid max-w-2xl rounded-3xl border-white/30 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {th ? 'รายละเอียดบันทึก' : 'Log Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedLog && formatDate(selectedLog.created_at)}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-5">
              {/* Summary row */}
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-400">{th ? 'ผู้ดำเนินการ' : 'Actor'}</p>
                  <p className="font-semibold text-gray-800">{getActorName(selectedLog.actor_user_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{th ? 'การดำเนินการ' : 'Action'}</p>
                  {actionBadge(selectedLog.action)}
                </div>
                <div>
                  <p className="text-xs text-gray-400">{th ? 'ประเภท' : 'Type'}</p>
                  <p className="font-semibold text-gray-800">{entityTypeLabel(selectedLog.entity_type)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{th ? 'เวลา' : 'Time'}</p>
                  <p className="font-semibold text-gray-800 text-xs">{formatDate(selectedLog.created_at)}</p>
                </div>
              </div>

              {/* Data blocks */}
              {selectedLog.entity_type === 'metric_value' ? (
                <div className="space-y-3">
                  {/* CREATE / INSERT */}
                  {['CREATE','INSERT'].includes(selectedLog.action.toUpperCase()) && selectedLog.after_data && (
                    renderMetricValueBlock(
                      selectedLog.after_data,
                      th ? '✅ ข้อมูลที่สร้างใหม่' : '✅ Created Record',
                      'border-emerald-200 bg-emerald-50/60'
                    )
                  )}

                  {/* DELETE */}
                  {selectedLog.action.toUpperCase() === 'DELETE' && selectedLog.before_data && (
                    renderMetricValueBlock(
                      selectedLog.before_data,
                      th ? '🗑 ข้อมูลที่ถูกลบ' : '🗑 Deleted Record',
                      'border-red-200 bg-red-50/60'
                    )
                  )}

                  {/* UPDATE — show before & after side-by-side */}
                  {selectedLog.action.toUpperCase() === 'UPDATE' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedLog.before_data && renderMetricValueBlock(
                        selectedLog.before_data,
                        th ? '⬅️ ก่อนแก้ไข' : '⬅️ Before',
                        'border-gray-200 bg-gray-50/60',
                        selectedLog.after_data
                      )}
                      {selectedLog.after_data && renderMetricValueBlock(
                        selectedLog.after_data,
                        th ? '➡️ หลังแก้ไข' : '➡️ After',
                        'border-blue-200 bg-blue-50/60',
                        selectedLog.before_data
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Generic entity */
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedLog.before_data && renderGenericBlock(
                    selectedLog.before_data,
                    th ? '⬅️ ก่อนเปลี่ยนแปลง' : '⬅️ Before',
                    'border-gray-200 bg-gray-50/60'
                  )}
                  {selectedLog.after_data && renderGenericBlock(
                    selectedLog.after_data,
                    th ? '➡️ หลังเปลี่ยนแปลง' : '➡️ After',
                    'border-blue-200 bg-blue-50/60'
                  )}
                </div>
              )}

              {/* Restore button */}
              {canRestore(selectedLog) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <Info className="h-4 w-4 shrink-0" />
                    {th
                      ? 'สามารถ Restore ค่านี้กลับสู่ระบบได้'
                      : 'You can restore this record back into the system.'}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-amber-400 text-amber-700 hover:bg-amber-100"
                    disabled={restoring}
                    onClick={handleRestoreClick}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {th ? 'Restore' : 'Restore'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Restore Confirm (no conflict) ────────────────────────────────── */}
      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent className="glass-card-solid rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <RotateCcw className="h-5 w-5" />
              {th ? 'ยืนยันการ Restore' : 'Confirm Restore'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              {th
                ? 'ต้องการนำข้อมูลนี้กลับเข้าสู่ระบบหรือไม่?'
                : 'Do you want to restore this record back into the system?'}
              {pendingRestoreData && (
                <span className="mt-2 block rounded-lg border bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                  {resolveName('metric_id', pendingRestoreData.metric_id)} · {resolveName('site_id', pendingRestoreData.site_id)} · {resolveName('period_id', pendingRestoreData.period_id)}
                  {' — '}
                  <span className="text-emerald-600">{String(pendingRestoreData.value)}</span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{th ? 'ยกเลิก' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeRestore(false)}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {th ? 'ยืนยัน Restore' : 'Confirm Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Restore Conflict (existing record) ───────────────────────────── */}
      <AlertDialog open={restoreConflictOpen} onOpenChange={setRestoreConflictOpen}>
        <AlertDialogContent className="glass-card-solid rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {th ? 'มีข้อมูลนี้ในระบบอยู่แล้ว' : 'Record Already Exists'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  {th
                    ? 'พบข้อมูลของ Metric / Site / Period นี้อยู่ในระบบแล้ว ต้องการ Restore ค่าเดิมทับข้อมูลปัจจุบันหรือไม่?'
                    : 'A record for this Metric / Site / Period already exists. Do you want to overwrite it with the restored value?'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {existingConflictValue && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs space-y-1">
                      <p className="font-semibold text-gray-500 uppercase text-[10px]">{th ? 'ค่าปัจจุบัน' : 'Current'}</p>
                      <p className="text-gray-700 font-medium">{String(existingConflictValue.value)}</p>
                      <p className="text-gray-400">{getStatusLabel(existingConflictValue.status)}</p>
                    </div>
                  )}
                  {pendingRestoreData && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs space-y-1">
                      <p className="font-semibold text-amber-600 uppercase text-[10px]">{th ? 'ค่าที่จะ Restore' : 'Restore to'}</p>
                      <p className="text-amber-700 font-medium">{String(pendingRestoreData.value)}</p>
                      <p className="text-amber-400">{getStatusLabel(pendingRestoreData.status)}</p>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="rounded-xl">{th ? 'ยกเลิก' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeRestore(true)}
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {th ? 'ยืนยัน Overwrite & Restore' : 'Overwrite & Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </PlanGate>
  );
}
