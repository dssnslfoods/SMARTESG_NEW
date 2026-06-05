import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { Plus, Edit, Trash2, Save, FileText, Building2, MapPin, Calendar, BarChart3, CheckSquare, Square, X, Leaf, TrendingUp, Clock, Filter, AlertTriangle, Database, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataEntryLoadingSkeleton } from "@/components/ui/loading-skeleton";
import { LoadingOverlay } from "@/components/ui/loading-progress";
import { invalidateMetricValueCache } from "@/hooks/useOptimizedData";

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
  code?: string | null;
  calc_mode?: string; // 'manual' (default) | 'auto' (GHG computed from activity data)
}
interface EmissionFactor { source_code: string; scope: number; factor_value: number; factor_unit: string | null; }
interface GhgMapping { target_code: string; source_code: string; }

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
  const { user, role, profile } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useAuditLog();

  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [dimensions, setDimensions] = useState<EsgDimension[]>([]);
  const [themes, setThemes] = useState<EsgTheme[]>([]);
  const [metrics, setMetrics] = useState<EsgMetric[]>([]);
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [ghgMappings, setGhgMappings] = useState<GhgMapping[]>([]);
  const [totalDbCount, setTotalDbCount] = useState<number>(0); // Actual count in database
  // Server-side summary counters (shown in the top cards even before records
  // are loaded), so the dashboard never shows 0 while the table is on demand.
  const [summary, setSummary] = useState({ total: 0, draft: 0, submitted: 0 });
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number | null }>({ loaded: 0, total: null });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<MetricValue | null>(null);
  const [existingMatch, setExistingMatch] = useState<MetricValue | null>(null);
  const [prefilledFromExisting, setPrefilledFromExisting] = useState(false);
  const latestLookupKeyRef = useRef<string | null>(null);

  // ── Data-entry permission for the current role (from data_entry_permission) ──
  const [rolePerm, setRolePerm] = useState<{
    can_create: boolean; create_scope: string; edit_scope: string; delete_scope: string;
  } | null>(null);

  // Legacy fallback = historical behaviour, used only if a row is missing so an
  // existing role is never accidentally locked out before its row is seeded.
  const LEGACY_PERM: Record<string, { can_create: boolean; create_scope: string; edit_scope: string; delete_scope: string }> = {
    supervisor: { can_create: true,  create_scope: 'all',      edit_scope: 'all',  delete_scope: 'all'  },
    executive:  { can_create: false, create_scope: 'all',      edit_scope: 'none', delete_scope: 'none' },
    staff:      { can_create: true,  create_scope: 'own_site', edit_scope: 'own',  delete_scope: 'own'  },
    guest:      { can_create: false, create_scope: 'all',      edit_scope: 'none', delete_scope: 'none' },
  };

  // Effective permission: admin/super_admin are always full.
  const dePerm = useMemo(() => {
    if (role === 'admin' || role === 'super_admin') {
      return { can_create: true, create_scope: 'all', edit_scope: 'all', delete_scope: 'all' };
    }
    return rolePerm ?? LEGACY_PERM[role ?? ''] ?? { can_create: false, create_scope: 'own_site', edit_scope: 'none', delete_scope: 'none' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, rolePerm]);

  useEffect(() => {
    if (!role || role === 'admin' || role === 'super_admin') return;
    supabase
      .from('data_entry_permission')
      .select('can_create, create_scope, edit_scope, delete_scope')
      .eq('role', role)
      .maybeSingle()
      .then(({ data }) => { if (data) setRolePerm(data as any); });
  }, [role]);

  // Whether the current user may edit / delete a specific record.
  const canEditRecord = (v: MetricValue) =>
    dePerm.edit_scope === 'all' || (dePerm.edit_scope === 'own' && v.submitted_by === user?.id);
  const canDeleteRecord = (v: MetricValue) =>
    dePerm.delete_scope === 'all' || (dePerm.delete_scope === 'own' && v.submitted_by === user?.id);

  // Confirm-update dialog for supervisor/admin
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
  const [pendingUpdateRecord, setPendingUpdateRecord] = useState<MetricValue | null>(null);

  const findExistingOnBackend = async (siteId: string, periodId: string, metricId: string) => {
    const { data, error } = await supabase
      .from('metric_value')
      .select('*')
      .eq('site_id', siteId)
      .eq('period_id', periodId)
      .eq('metric_id', metricId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as MetricValue | null;
  };
  
  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Filter states
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [filterDimension, setFilterDimension] = useState<string>("");
  const [filterTheme, setFilterTheme] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  // Records are loaded on demand (filter-first + Search), not on page load.
  const [hasSearched, setHasSearched] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [PAGE_SIZE, setPageSize] = useState<number>(15);

  // Period filter settings (admin-configurable via System Settings)
  const [periodFilterMode, setPeriodFilterMode] = useState<'recent' | 'from' | 'all'>('recent');
  const [recentMonths, setRecentMonths] = useState<number>(4);
  const [fromYear, setFromYear] = useState<number>(new Date().getFullYear());
  const [fromMonth, setFromMonth] = useState<number>(1);

  // Load app settings (page size + period filter)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_setting')
        .select('key,value')
        .in('key', [
          'data_entry_page_size',
          'data_entry_filter_mode',
          'data_entry_recent_months',
          'data_entry_from_year',
          'data_entry_from_month',
        ]);
      const map = new Map((data ?? []).map((r: any) => [r.key, r.value as string]));
      const ps = parseInt(map.get('data_entry_page_size') ?? '', 10);
      if (Number.isFinite(ps) && ps > 0) setPageSize(ps);
      const mode = map.get('data_entry_filter_mode');
      if (mode === 'recent' || mode === 'from' || mode === 'all') setPeriodFilterMode(mode);
      const rm = parseInt(map.get('data_entry_recent_months') ?? '', 10);
      if (Number.isFinite(rm) && rm > 0) setRecentMonths(rm);
      const fy = parseInt(map.get('data_entry_from_year') ?? '', 10);
      if (Number.isFinite(fy)) setFromYear(fy);
      const fm = parseInt(map.get('data_entry_from_month') ?? '', 10);
      if (Number.isFinite(fm) && fm >= 1 && fm <= 12) setFromMonth(fm);
    })();
  }, []);


  // Form filter states
  const [formCompany, setFormCompany] = useState<string>("");
  const [formDimension, setFormDimension] = useState<string>("");
  const [formTheme, setFormTheme] = useState<string>("");
  const [formMonth, setFormMonth] = useState<string>("");
  const [formYear, setFormYear] = useState<string>("");

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
    fetchMasterData();
    fetchSummary();
  }, []);

  // Pull RLS-respecting counters (total / draft / submitted) for the top cards.
  const fetchSummary = async () => {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_metric_stats');
      if (error) throw error;
      const s = data as any;
      setSummary({
        total: Number(s?.total ?? 0),
        draft: Number(s?.draft ?? 0),
        submitted: Number(s?.submitted ?? 0),
      });
    } catch (e) {
      console.error('Error fetching summary:', e);
    }
  };

  // Master data only (small lists for the form + filters). Loaded on mount.
  // Metric VALUE records are intentionally NOT loaded here — see fetchRecords().
  const fetchMasterData = async () => {
    try {
      const [
        { data: sitesData },
        { data: companiesData },
        { data: periodsData },
        { data: dimensionsData },
        { data: themesData },
        { data: metricsData },
        { data: factorsData },
        { data: ghgMapData },
      ] = await Promise.all([
        supabase.from('site').select('*').order('site_name'),
        supabase.from('company').select('*').order('company_name'),
        supabase.from('reporting_period').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('esg_dimension').select('*').order('dimension_name'),
        supabase.from('esg_theme').select('*').order('theme_name'),
        supabase.from('esg_metric').select('*').order('metric_name'),
        supabase.from('emission_factor').select('source_code, scope, factor_value, factor_unit'),
        supabase.from('ghg_calc_mapping').select('target_code, source_code'),
      ]);
      setSites(sitesData || []);
      setCompanies(companiesData || []);
      setPeriods(periodsData || []);
      setDimensions(dimensionsData || []);
      setThemes(themesData || []);
      setMetrics(metricsData || []);
      setFactors((factorsData || []) as EmissionFactor[]);
      setGhgMappings((ghgMapData || []) as GhgMapping[]);
    } catch (error) {
      console.error('Error fetching master data:', error);
    }
  };

  // On-demand record loader. Scopes the query server-side by the current
  // Company / Site / Period / Status filters, then paginates through ALL
  // matching rows (PostgREST caps a single request at ~1000) so the table
  // shows every record in the selected scope — no artificial limit.
  // Dimension/Theme are refined client-side on the loaded set.
  const PAGE = 1000;
  const fetchRecords = async () => {
    setLoading(true);
    setHasSearched(true);
    setLoadProgress({ loaded: 0, total: null });
    try {
      const companyScopeIds =
        !filterSite && filterCompany
          ? (sites.filter(s => s.company_id === filterCompany).map(s => s.site_id) || [])
          : null;

      const all: MetricValue[] = [];
      let from = 0;
      let total: number | null = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from('metric_value')
          .select(
            'value_id, metric_id, site_id, period_id, value, status, data_source, remark, submitted_by, created_at',
            from === 0 ? { count: 'exact' } : undefined,
          );

        if (filterSite) q = q.eq('site_id', filterSite);
        else if (companyScopeIds) q = q.in('site_id', companyScopeIds.length ? companyScopeIds : ['__none__']);
        if (filterPeriod) q = q.eq('period_id', filterPeriod);
        if (filterStatus) q = q.eq('status', filterStatus);

        const { data, count, error } = await q
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;

        if (from === 0 && count != null) {
          total = count;
          setLoadProgress(prev => ({ ...prev, total: count }));
        }
        (data || []).forEach(v => all.push({
          value_id: v.value_id,
          metric_id: v.metric_id,
          site_id: v.site_id,
          period_id: v.period_id,
          value: v.value,
          status: v.status,
          data_source: v.data_source,
          remark: v.remark,
          submitted_by: v.submitted_by,
          created_at: v.created_at,
        }));
        setLoadProgress(prev => ({ ...prev, loaded: all.length }));

        if (!data || data.length < PAGE) break;
        from += PAGE;
      }

      setTotalDbCount(total ?? all.length);
      setMetricValues(all);
      invalidateMetricValueCache();
      fetchSummary(); // keep the top cards in sync after a load / mutation
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateValueId = () => {
    return `VAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleCreate = () => {
    setEditingValue(null);
    setExistingMatch(null);
    setPrefilledFromExisting(false);
    setFormDimension('');
    setFormTheme('');
    setFormMonth('');
    setFormYear('');

    // Pre-fill company/site according to the role's create scope:
    //   own_site    → lock to the user's profile site (and its company)
    //   own_company → lock the company to the user's profile company
    //   all         → free choice
    let presetCompany = '';
    let presetSite = '';
    if (dePerm.create_scope === 'own_site' && profile?.site_id) {
      presetSite = profile.site_id;
      presetCompany = profile.company_id || sites.find(s => s.site_id === profile.site_id)?.company_id || '';
    } else if (dePerm.create_scope === 'own_company' && profile?.company_id) {
      presetCompany = profile.company_id;
    }
    setFormCompany(presetCompany);

    setFormData({
      value_id: generateValueId(),
      site_id: presetSite,
      period_id: '',
      metric_id: '',
      value: 0,
      data_source: '',
      remark: '',
      status: 'draft',
    });
    setIsDialogOpen(true);
  };

  // Filter sites by selected company in form
  const formFilteredSites = formCompany
    ? sites.filter(s => s.company_id === formCompany)
    : sites;

  const handleEdit = (value: MetricValue) => {
    const metric = metrics.find(m => m.metric_id === value.metric_id);
    const theme = themes.find(t => t.theme_id === metric?.theme_id);
    const site = sites.find(s => s.site_id === value.site_id);
    
    setEditingValue(value);
    setExistingMatch(null);
    setPrefilledFromExisting(false);
    setFormCompany(site?.company_id || '');
    setFormDimension(theme?.dimension_id || '');
    setFormTheme(metric?.theme_id || '');
    const editPeriod = periods.find(p => p.period_id === value.period_id);
    setFormMonth(editPeriod ? String(editPeriod.month) : '');
    setFormYear(editPeriod ? String(editPeriod.year) : '');
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

  // Auto-load existing record into the form when user selects Site + Period + Metric
  // (so users can "search" by selections and see existing values, and avoid duplicate key errors)
  useEffect(() => {
    if (!isDialogOpen) return;
    if (editingValue) return; // explicit edit mode should not be overwritten

    const { site_id, period_id, metric_id } = formData;
    if (!site_id || !period_id || !metric_id) {
      // If previously prefilled and user cleared a selector, reset
      if (existingMatch) {
        setExistingMatch(null);
        setPrefilledFromExisting(false);
        setFormData(prev => ({
          ...prev,
          value_id: generateValueId(),
          value: 0,
          data_source: '',
          remark: '',
          status: 'draft',
        }));
      }
      return;
    }

    const lookupKey = `${site_id}::${period_id}::${metric_id}`;
    latestLookupKeyRef.current = lookupKey;

    (async () => {
      try {
        const match = await findExistingOnBackend(site_id, period_id, metric_id);
        if (latestLookupKeyRef.current !== lookupKey) return;

        if (!match) {
          if (existingMatch) {
            setExistingMatch(null);
            setPrefilledFromExisting(false);
            setFormData(prev => ({
              ...prev,
              value_id: generateValueId(),
              value: 0,
              data_source: '',
              remark: '',
              status: 'draft',
            }));
          }
          return;
        }

        if (existingMatch?.value_id === match.value_id) return;

        setExistingMatch(match);
        setPrefilledFromExisting(true);
        setFormData(prev => ({
          ...prev,
          value_id: match.value_id,
          value: match.value,
          data_source: match.data_source || '',
          remark: match.remark || '',
          status: match.status,
        }));
      } catch {
        // If user doesn't have permission to view an existing record, we can't prefill it.
        // We'll still handle uniqueness at save time.
      }
    })();
  }, [isDialogOpen, editingValue, formData.site_id, formData.period_id, formData.metric_id, existingMatch]);

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
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(valueId);
        return newSet;
      });
      fetchRecords();
    }
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredValues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredValues.map(v => v.value_id)));
    }
  };

  const handleSelectOne = (valueId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(valueId)) {
        newSet.delete(valueId);
      } else {
        newSet.add(valueId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    const valuesToDelete = metricValues.filter(v => idsToDelete.includes(v.value_id));
    
    const { error } = await supabase
      .from('metric_value')
      .delete()
      .in('value_id', idsToDelete);

    if (error) {
      toast({
        title: language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      // Log each deletion
      for (const value of valuesToDelete) {
        await logActivity({
          action: 'DELETE',
          entityType: 'metric_value',
          entityId: value.value_id,
          beforeData: value,
        });
      }
      toast({
        title: language === 'th' ? 'สำเร็จ' : 'Success',
        description: language === 'th' 
          ? `ลบข้อมูล ${idsToDelete.length} รายการสำเร็จ` 
          : `${idsToDelete.length} records deleted successfully`,
      });
      setSelectedIds(new Set());
      setIsDeleteDialogOpen(false);
      fetchRecords();
    }
  };

  // Called when supervisor/admin confirms updating an existing record
  const executeConfirmedUpdate = async () => {
    if (!pendingUpdateRecord || !user?.id) return;
    setConfirmUpdateOpen(false);

    const dataToUpdate = {
      value: formData.value,
      data_source: formData.data_source || null,
      remark: formData.remark || null,
      status: formData.status,
      submitted_by: user.id,
    };

    const { error: updateError } = await supabase
      .from('metric_value')
      .update(dataToUpdate)
      .eq('value_id', pendingUpdateRecord.value_id);

    if (updateError) {
      toast({
        title: language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        description: updateError.message,
        variant: 'destructive',
      });
    } else {
      await logActivity({
        action: 'UPDATE',
        entityType: 'metric_value',
        entityId: pendingUpdateRecord.value_id,
        beforeData: pendingUpdateRecord,
        afterData: { ...pendingUpdateRecord, ...dataToUpdate },
      });
      toast({
        title: language === 'th' ? 'อัปเดตสำเร็จ' : 'Updated',
        description: language === 'th' ? 'อัปเดตข้อมูลเรียบร้อยแล้ว' : 'Record updated successfully',
      });
      setPendingUpdateRecord(null);
      setIsDialogOpen(false);
      fetchRecords();
    }
  };


  const handleSubmit = async () => {
    // The Month + Year dropdowns are independent, so the chosen combination may
    // not have a reporting_period row yet (e.g. the current month). Resolve —
    // and create on demand — the period_id before validating.
    let periodId = formData.period_id;
    if (!periodId && formMonth && formYear) {
      try {
        const { data: pid, error } = await supabase.rpc('get_or_create_period', {
          p_year: Number(formYear),
          p_month: Number(formMonth),
        });
        if (error) throw error;
        if (pid) {
          periodId = pid as string;
          setFormData(prev => ({ ...prev, period_id: pid as string }));
          // refresh the period list so it shows up in tables/filters
          fetchMasterData();
        }
      } catch (e) {
        console.error('get_or_create_period error:', e);
      }
    }

    if (!formData.site_id || !periodId || !formData.metric_id) {
      toast({
        title: language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all required fields',
        description: language === 'th'
          ? 'ต้องเลือก: บริษัท · สถานที่ · เดือน/ปี · ตัวชี้วัด'
          : 'Required: Company · Site · Month/Year · Metric',
        variant: 'destructive',
      });
      return;
    }

    // Auto (GHG-computed) metrics can't be entered directly — they are derived
    // from activity data by the database. Tell the user to enter the activity.
    const selectedMetric = metrics.find(m => m.metric_id === formData.metric_id);
    if (!editingValue && selectedMetric?.calc_mode === 'auto') {
      toast({
        title: language === 'th' ? 'ตัวชี้วัดนี้คำนวณอัตโนมัติ' : 'This metric is auto-calculated',
        description: language === 'th'
          ? 'GHG คำนวณจากข้อมูลกิจกรรม (เช่น ดีเซล, ไฟฟ้า) — กรุณากรอกค่ากิจกรรมเหล่านั้นแทน'
          : 'GHG is computed from activity data (e.g. diesel, electricity). Please enter those activity values instead.',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: language === 'th' ? 'กรุณาเข้าสู่ระบบใหม่' : 'Please sign in again',
        description:
          language === 'th'
            ? 'ไม่พบข้อมูลผู้ใช้สำหรับการบันทึก กรุณาออกจากระบบและเข้าสู่ระบบใหม่อีกครั้ง'
            : 'User session not found for saving. Please sign out and sign in again.',
        variant: 'destructive',
      });
      return;
    }

    // Check from backend to avoid stale state and guarantee uniqueness behavior
    let existingRecord: MetricValue | null = null;
    try {
      existingRecord = await findExistingOnBackend(formData.site_id, periodId, formData.metric_id);
    } catch {
      existingRecord = null;
    }

    if (existingRecord && !editingValue) {
      const canUpdate = role === 'admin' || role === 'supervisor' || role === 'super_admin';

      if (!canUpdate) {
        // staff / executive / guest → block entirely
        toast({
          title: language === 'th' ? 'มีข้อมูลนี้อยู่ในระบบแล้ว' : 'Record already exists',
          description: language === 'th'
            ? 'ข้อมูลของ Metric / Site / Period นี้ถูกบันทึกไว้แล้ว กรุณาติดต่อ Supervisor หรือ Admin หากต้องการแก้ไข'
            : 'A record for this Metric / Site / Period already exists. Contact a Supervisor or Admin to update it.',
          variant: 'destructive',
        });
        return;
      }

      // supervisor / admin → open confirmation dialog
      setPendingUpdateRecord(existingRecord);
      setConfirmUpdateOpen(true);
      return;
    }

    const dataToSave = {
      value_id: formData.value_id,
      site_id: formData.site_id,
      period_id: periodId,
      metric_id: formData.metric_id,
      value: formData.value,
      data_source: formData.data_source || null,
      remark: formData.remark || null,
      status: formData.status,
      submitted_by: user.id,
    };

    let error;
    if (editingValue) {
      // If user changed site/period/metric to a combo that already exists in another row,
      // PostgREST PATCH would violate the unique constraint. Detect & handle gracefully.
      const conflict =
        existingRecord &&
        existingRecord.value_id !== editingValue.value_id;

      if (conflict) {
        toast({
          title: language === 'th' ? 'ข้อมูลซ้ำ' : 'Duplicate record',
          description:
            language === 'th'
              ? 'มีข้อมูลของ Metric / Site / Period นี้อยู่แล้วในแถวอื่น กรุณาแก้ไขแถวนั้นแทน หรือเลือก Metric/Site/Period ใหม่'
              : 'A record with this Metric/Site/Period combination already exists in another row. Please edit that row instead, or choose a different Metric/Site/Period.',
          variant: 'destructive',
        });
        return;
      }

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
      // Use upsert to handle duplicate key gracefully at database level
      // This works even when RLS prevents SELECT of the existing record
      const { data: upsertedData, error: upsertError } = await supabase
        .from('metric_value')
        .upsert(dataToSave, { 
          onConflict: 'site_id,period_id,metric_id',
          ignoreDuplicates: false 
        })
        .select()
        .maybeSingle();
      
      error = upsertError;
      
      if (!upsertError) {
        // Determine if this was an insert or update based on whether we had existingMatch
        const wasUpdate = existingMatch || prefilledFromExisting;
        await logActivity({
          action: wasUpdate ? 'UPDATE' : 'CREATE',
          entityType: 'metric_value',
          entityId: upsertedData?.value_id || formData.value_id,
          beforeData: wasUpdate ? existingMatch : undefined,
          afterData: upsertedData || dataToSave,
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
      fetchRecords();
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

  // Period filter window driven by admin System Settings.
  // Drafts are always shown regardless of period.
  const periodById = useMemo(() => {
    const map = new Map<string, ReportingPeriod>();
    periods.forEach(p => map.set(p.period_id, p));
    return map;
  }, [periods]);

  const allowedPeriodIds = useMemo(() => {
    if (periodFilterMode === 'all') return null as Set<string> | null;
    if (periods.length === 0) return null;

    if (periodFilterMode === 'recent') {
      // Latest (year, month) actually present in metric values
      let latestKey = -1;
      metricValues.forEach(v => {
        const p = periodById.get(v.period_id);
        if (!p) return;
        const key = p.year * 12 + (p.month - 1);
        if (key > latestKey) latestKey = key;
      });
      if (latestKey < 0) return null;
      const cutoff = latestKey - (Math.max(1, recentMonths) - 1);
      const set = new Set<string>();
      periods.forEach(p => {
        const key = p.year * 12 + (p.month - 1);
        if (key <= latestKey && key >= cutoff) set.add(p.period_id);
      });
      return set;
    }

    // 'from' mode — show everything from (fromYear, fromMonth) onwards
    const fromKey = fromYear * 12 + (fromMonth - 1);
    const set = new Set<string>();
    periods.forEach(p => {
      const key = p.year * 12 + (p.month - 1);
      if (key >= fromKey) set.add(p.period_id);
    });
    return set;
  }, [periods, metricValues, periodById, periodFilterMode, recentMonths, fromYear, fromMonth]);

  const activePeriods = useMemo(() => {
    if (periodFilterMode === 'all') return null;
    if (!allowedPeriodIds) return [];
    return periods
      .filter(p => allowedPeriodIds.has(p.period_id))
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }, [periods, allowedPeriodIds, periodFilterMode]);

  // Filter metric values
  const filteredValues = metricValues.filter(v => {
    // Admin-configured period window (drafts always visible)
    if (allowedPeriodIds && v.status !== 'draft' && !allowedPeriodIds.has(v.period_id)) {
      return false;
    }
    // Filter by company: check if site belongs to the selected company
    if (filterCompany) {
      const site = sites.find(s => s.site_id === v.site_id);
      if (site?.company_id !== filterCompany) return false;
    }
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

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredValues.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedValues = filteredValues.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCompany, filterSite, filterPeriod, filterDimension, filterTheme, filterStatus]);

  const unique = (items: string[]) => Array.from(new Set(items)).filter(Boolean);

  const getFilterDropReason = () => {
    if (metricValues.length === 0) return null;

    const companyStep = filterCompany
      ? metricValues.filter(v => {
          const site = sites.find(s => s.site_id === v.site_id);
          return site?.company_id === filterCompany;
        })
      : metricValues;

    const siteStep = filterSite ? companyStep.filter(v => v.site_id === filterSite) : companyStep;
    const periodStep = filterPeriod ? siteStep.filter(v => v.period_id === filterPeriod) : siteStep;
    const statusStep = filterStatus ? periodStep.filter(v => v.status === filterStatus) : periodStep;
    const themeStep = filterTheme
      ? statusStep.filter(v => {
          const metric = metrics.find(m => m.metric_id === v.metric_id);
          return metric?.theme_id === filterTheme;
        })
      : statusStep;
    const dimensionStep = filterDimension
      ? themeStep.filter(v => {
          const metric = metrics.find(m => m.metric_id === v.metric_id);
          const theme = themes.find(t => t.theme_id === metric?.theme_id);
          return theme?.dimension_id === filterDimension;
        })
      : themeStep;

    // If final result has data, no need to show reason.
    if (dimensionStep.length > 0) return null;

    // Identify the first filter that drops the dataset to zero.
    if (filterCompany && companyStep.length === 0) {
      return {
        key: 'company' as const,
        available: unique(metricValues.map(v => sites.find(s => s.site_id === v.site_id)?.company_id || '')).slice(0, 8),
      };
    }
    if (filterSite && siteStep.length === 0) {
      return {
        key: 'site' as const,
        available: unique(companyStep.map(v => v.site_id)).slice(0, 8),
      };
    }
    if (filterPeriod && periodStep.length === 0) {
      return {
        key: 'period' as const,
        available: unique(siteStep.map(v => v.period_id)).slice(0, 8),
      };
    }
    if (filterStatus && statusStep.length === 0) {
      return {
        key: 'status' as const,
        available: unique(periodStep.map(v => v.status)).slice(0, 8),
      };
    }
    if (filterTheme && themeStep.length === 0) {
      const themeIds = unique(
        statusStep
          .map(v => metrics.find(m => m.metric_id === v.metric_id)?.theme_id || '')
          .filter(Boolean)
      );
      return {
        key: 'theme' as const,
        available: themeIds.slice(0, 8),
      };
    }
    if (filterDimension && dimensionStep.length === 0) {
      const dimensionIds = unique(
        themeStep
          .map(v => {
            const metric = metrics.find(m => m.metric_id === v.metric_id);
            const theme = themes.find(t => t.theme_id === metric?.theme_id);
            return theme?.dimension_id || '';
          })
          .filter(Boolean)
      );
      return {
        key: 'dimension' as const,
        available: dimensionIds.slice(0, 8),
      };
    }

    return null;
  };

  const filterDropReason = getFilterDropReason();

  const isAllSelected = filteredValues.length > 0 && selectedIds.size === filteredValues.length;
  const isPartialSelected = selectedIds.size > 0 && selectedIds.size < filteredValues.length;

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

  if (loading) {
    return (
      <>
        <LoadingOverlay
          loaded={loadProgress.loaded}
          total={loadProgress.total}
          isLoading={loading && loadProgress.loaded > 0}
          message="กำลังโหลดข้อมูล ESG"
        />
        <DataEntryLoadingSkeleton />
      </>
    );
  }

  return (
    <div className="space-y-6 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 min-h-screen -m-6 p-6">
      {/* Header with Gradient Accent */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-full" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl shadow-lg shadow-emerald-500/25">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {language === 'th' ? 'บันทึกข้อมูล ESG' : 'ESG Data Entry'}
              </h1>
              <p className="text-gray-500 mt-0.5">
                {language === 'th' ? 'บันทึกและจัดการข้อมูลตัวชี้วัด ESG' : 'Record and manage ESG metric values'}
              </p>
            </div>
          </div>
          {dePerm.can_create && (
            <Button
              onClick={handleCreate}
              className="gap-2 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-xl px-6 py-2.5 border-0"
            >
              <Plus className="h-4 w-4" />
              {language === 'th' ? 'เพิ่มข้อมูล' : 'Add Data'}
            </Button>
          )}
        </div>
      </div>

      {/* Database Sync Status Banner */}
      {totalDbCount > 0 && metricValues.length !== totalDbCount && (
        <Card className="glass-card border-amber-200/60 overflow-hidden">
          <CardContent className="py-3">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">
                {language === 'th' 
                  ? `แสดง ${metricValues.length.toLocaleString()} จาก ${totalDbCount.toLocaleString()} รายการ (RLS อาจซ่อนบางรายการ)` 
                  : `Showing ${metricValues.length.toLocaleString()} of ${totalDbCount.toLocaleString()} records (RLS may hide some records)`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards - Glass Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card relative cursor-pointer hover:scale-[1.02] transition-all duration-300 overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-400 to-violet-500" />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-600">
              <div className="p-1.5 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Database className="h-4 w-4 text-purple-600" />
              </div>
              {language === 'th' ? 'ข้อมูลใน Database' : 'Database Records'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-800">{summary.total.toLocaleString()}</p>
            <p className="text-xs text-purple-600 mt-1">{language === 'th' ? 'รายการทั้งหมด' : 'total entries'}</p>
          </CardContent>
        </Card>

        <Card className="glass-card relative cursor-pointer hover:scale-[1.02] transition-all duration-300 overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-600">
              <div className="p-1.5 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
              </div>
              {language === 'th' ? 'ข้อมูลที่เห็น' : 'Visible Records'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-800">{(hasSearched ? metricValues.length : summary.total).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{language === 'th' ? 'รายการ' : 'entries'}</p>
          </CardContent>
        </Card>

        <Card className="glass-card relative cursor-pointer hover:scale-[1.02] transition-all duration-300 overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-600">
              <div className="p-1.5 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              {language === 'th' ? 'ร่าง' : 'Draft'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-800">{summary.draft.toLocaleString()}</p>
            <p className="text-xs text-amber-600 mt-1">{language === 'th' ? 'รอดำเนินการ' : 'pending'}</p>
          </CardContent>
        </Card>

        <Card className="glass-card relative cursor-pointer hover:scale-[1.02] transition-all duration-300 overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-600">
              <div className="p-1.5 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              {language === 'th' ? 'ส่งแล้ว' : 'Submitted'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-800">{summary.submitted.toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-1">{language === 'th' ? 'เสร็จสิ้น' : 'completed'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Periods Summary */}
      <Card className="glass-card-solid overflow-hidden">
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-gray-700">
            <Calendar className="h-4 w-4 text-emerald-600" />
            {language === 'th' ? 'ช่วงเวลาที่แสดงผล (ตามการตั้งค่าระบบ)' : 'Active Periods (System Setting)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            {periodFilterMode === 'all' ? (
              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 rounded-lg px-3 py-1">
                {language === 'th' ? 'แสดงทั้งหมด' : 'Show all periods'}
              </Badge>
            ) : (
              activePeriods && activePeriods.length > 0 ? (
                activePeriods.map(p => (
                  <Badge key={p.period_id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 rounded-lg px-3 py-1">
                    {p.month_name} {p.year}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-gray-500">
                  {language === 'th' ? 'ไม่มีข้อมูลในช่วงเวลาที่กรอง' : 'No data in filtered period range'}
                </span>
              )
            )}
          </div>
          {periodFilterMode !== 'all' && (
            <p className="text-xs text-gray-500 mt-2">
              {periodFilterMode === 'recent'
                ? (language === 'th' ? `ย้อนหลัง ${recentMonths} เดือน จากเดือนล่าสุดในข้อมูล` : `Last ${recentMonths} months from latest data`)
                : (language === 'th' ? `ตั้งแต่เดือน ${fromMonth} ปี ${fromYear}` : `From month ${fromMonth}, ${fromYear}`)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters Card - Glass Style */}
      <Card className="glass-card-solid overflow-hidden">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <Filter className="h-4 w-4 text-gray-600" />
            </div>
            {language === 'th' ? 'ตัวกรอง' : 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Building2 className="h-3.5 w-3.5 text-gray-500" />
                {language === 'th' ? 'บริษัท' : 'Company'}
              </Label>
              <Select value={filterCompany || "__all__"} onValueChange={(v) => { setFilterCompany(v === "__all__" ? "" : v); setFilterSite(''); }}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                  <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
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
              <Label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MapPin className="h-3.5 w-3.5 text-gray-500" />
                {language === 'th' ? 'สถานที่' : 'Site'}
              </Label>
              <Select value={filterSite || "__all__"} onValueChange={(v) => setFilterSite(v === "__all__" ? "" : v)}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                  <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
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
              <Label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                {language === 'th' ? 'รอบระยะเวลา' : 'Period'}
              </Label>
              <Select value={filterPeriod || "__all__"} onValueChange={(v) => setFilterPeriod(v === "__all__" ? "" : v)}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                  <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
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
              <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'มิติ ESG' : 'Dimension'}</Label>
              <Select value={filterDimension || "__all__"} onValueChange={(v) => { setFilterDimension(v === "__all__" ? "" : v); setFilterTheme(''); }}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                  <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
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
              <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'หัวข้อ ESG' : 'Theme'}</Label>
              <Select value={filterTheme || "__all__"} onValueChange={(v) => setFilterTheme(v === "__all__" ? "" : v)}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                  <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
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
              <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'สถานะ' : 'Status'}</Label>
              <Select value={filterStatus || "__all__"} onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                  <SelectValue placeholder={language === 'th' ? 'ทั้งหมด' : 'All'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                  <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                  <SelectItem value="draft">{language === 'th' ? 'ร่าง' : 'Draft'}</SelectItem>
                  <SelectItem value="submitted">{language === 'th' ? 'ส่งแล้ว' : 'Submitted'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* On-demand search — records load only when requested, scoped to the
              selected filters (keeps the page fast at any data volume). */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={fetchRecords}
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:shadow-lg rounded-xl px-6"
            >
              <Search className="h-4 w-4" />
              {loading
                ? (language === 'th' ? 'กำลังค้นหา...' : 'Searching...')
                : (language === 'th' ? 'ค้นหา / แสดงข้อมูล' : 'Search / Load Records')}
            </Button>
            {hasSearched && (
              <Button
                variant="outline"
                onClick={() => {
                  setFilterCompany(''); setFilterSite(''); setFilterPeriod('');
                  setFilterDimension(''); setFilterTheme(''); setFilterStatus('');
                }}
                className="gap-1.5 rounded-xl"
              >
                <X className="h-3.5 w-3.5" />
                {language === 'th' ? 'ล้างตัวกรอง' : 'Clear filters'}
              </Button>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {hasSearched && (
              <div className="text-xs text-gray-500">
                {language === 'th'
                  ? `โหลดมา ${metricValues.length.toLocaleString()} รายการ • หลังกรอง ${filteredValues.length.toLocaleString()} รายการ`
                  : `Loaded ${metricValues.length.toLocaleString()} • After filters ${filteredValues.length.toLocaleString()}`}
              </div>
            )}

            {filterDropReason && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {language === 'th' ? (
                  <>
                    ไม่พบข้อมูลหลังกรองที่ <b>{filterDropReason.key}</b> — ค่าที่มีในระบบ (ตัวอย่าง):{' '}
                    <b>
                      {filterDropReason.available
                        .map((id) => {
                          switch (filterDropReason.key) {
                            case 'company':
                              return id ? getDisplayName(id, 'company') : id;
                            case 'site':
                              return id ? getDisplayName(id, 'site') : id;
                            case 'period':
                              return id ? getDisplayName(id, 'period') : id;
                            case 'theme':
                              return id ? getDisplayName(id, 'theme') : id;
                            case 'dimension':
                              return id ? getDisplayName(id, 'dimension') : id;
                            case 'status':
                              return getStatusLabel(id);
                            default:
                              return id;
                          }
                        })
                        .join(', ') || '-'}
                    </b>
                  </>
                ) : (
                  <>
                    No records after filtering at <b>{filterDropReason.key}</b>. Available values (sample):{' '}
                    <b>
                      {filterDropReason.available
                        .map((id) => {
                          switch (filterDropReason.key) {
                            case 'company':
                              return id ? getDisplayName(id, 'company') : id;
                            case 'site':
                              return id ? getDisplayName(id, 'site') : id;
                            case 'period':
                              return id ? getDisplayName(id, 'period') : id;
                            case 'theme':
                              return id ? getDisplayName(id, 'theme') : id;
                            case 'dimension':
                              return id ? getDisplayName(id, 'dimension') : id;
                            case 'status':
                              return getStatusLabel(id);
                            default:
                              return id;
                          }
                        })
                        .join(', ') || '-'}
                    </b>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table Card - Glass Style */}
      <Card className="glass-card-solid overflow-hidden">
        <CardHeader className="border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-3 text-gray-800">
              {language === 'th' ? 'รายการข้อมูล' : 'Data Records'}
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full px-3">
                {filteredValues.length.toLocaleString()} {language === 'th' ? 'รายการ' : 'records'}
              </Badge>
              {selectedIds.size > 0 && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 rounded-full px-3">
                  {language === 'th' ? `เลือก ${selectedIds.size} รายการ` : `${selectedIds.size} selected`}
                </Badge>
              )}
            </CardTitle>
            {selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="gap-2 rounded-xl shadow-lg"
              >
                <Trash2 className="h-4 w-4" />
                {language === 'th' ? `ลบที่เลือก (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              {language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
            </div>
          ) : !hasSearched ? (
            <div className="text-center py-16">
              <div className="p-4 bg-emerald-50 rounded-2xl inline-block mb-4">
                <Search className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-gray-700 font-medium">
                {language === 'th' ? 'เลือกตัวกรองแล้วกด “ค้นหา / แสดงข้อมูล”' : 'Choose filters, then click “Search / Load Records”'}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {language === 'th'
                  ? 'ระบบจะดึงเฉพาะข้อมูลตามขอบเขตที่เลือก เพื่อให้โหลดเร็วแม้ข้อมูลจำนวนมาก'
                  : 'Only the selected scope is loaded, so the page stays fast even with large datasets'}
              </p>
              <Button
                onClick={fetchRecords}
                className="mt-5 gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md rounded-xl px-6"
              >
                <Search className="h-4 w-4" />
                {language === 'th' ? 'ค้นหา / แสดงข้อมูล' : 'Search / Load Records'}
              </Button>
            </div>
          ) : filteredValues.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-100 rounded-2xl inline-block mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500">{language === 'th' ? 'ไม่พบข้อมูล' : 'No data found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label={language === 'th' ? 'เลือกทั้งหมด' : 'Select all'}
                        className={isPartialSelected ? 'data-[state=checked]:bg-emerald-500/50' : ''}
                      />
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">{language === 'th' ? 'สถานที่' : 'Site'}</TableHead>
                    <TableHead className="font-semibold text-gray-700">{language === 'th' ? 'รอบระยะเวลา' : 'Period'}</TableHead>
                    <TableHead className="font-semibold text-gray-700">{language === 'th' ? 'ตัวชี้วัด' : 'Metric'}</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">{language === 'th' ? 'ค่า' : 'Value'}</TableHead>
                    <TableHead className="font-semibold text-gray-700">{language === 'th' ? 'สถานะ' : 'Status'}</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">{language === 'th' ? 'จัดการ' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedValues.map((value) => (
                    <TableRow 
                      key={value.value_id} 
                      data-state={selectedIds.has(value.value_id) ? 'selected' : undefined}
                      className="hover:bg-emerald-50/50 transition-colors"
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(value.value_id)}
                          onCheckedChange={() => handleSelectOne(value.value_id)}
                          aria-label={language === 'th' ? 'เลือกรายการ' : 'Select row'}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {getDisplayName(value.site_id, 'site')}
                      </TableCell>
                      <TableCell className="text-gray-600">{getDisplayName(value.period_id, 'period')}</TableCell>
                      <TableCell className="text-gray-600">{getDisplayName(value.metric_id, 'metric')}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-gray-900">
                        {value.value.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`rounded-full px-3 ${
                            value.status === 'submitted' 
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                              : 'bg-amber-100 text-amber-700 border-amber-200'
                          }`}
                        >
                          {getStatusLabel(value.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEditRecord(value) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(value)}
                              className="h-8 w-8 rounded-lg hover:bg-emerald-100 hover:text-emerald-700"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteRecord(value) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(value.value_id)}
                              className="h-8 w-8 rounded-lg hover:bg-red-100 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {!canEditRecord(value) && !canDeleteRecord(value) && (
                            <span className="text-[11px] text-muted-foreground/50 italic pr-1">
                              {language === 'th' ? '— ดูอย่างเดียว' : '— view only'}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && filteredValues.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <div className="text-sm text-gray-600">
                {language === 'th'
                  ? `แสดง ${((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}-${Math.min(safePage * PAGE_SIZE, filteredValues.length).toLocaleString()} จาก ${filteredValues.length.toLocaleString()} รายการ`
                  : `Showing ${((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}-${Math.min(safePage * PAGE_SIZE, filteredValues.length).toLocaleString()} of ${filteredValues.length.toLocaleString()}`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage === 1}
                >
                  «
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  {language === 'th' ? 'ก่อนหน้า' : 'Prev'}
                </Button>
                <span className="text-sm text-gray-700 px-2">
                  {language === 'th' ? `หน้า ${safePage} / ${totalPages}` : `Page ${safePage} / ${totalPages}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  {language === 'th' ? 'ถัดไป' : 'Next'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage === totalPages}
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog - Glass Style */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="glass-card-solid max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden rounded-3xl">
          <DialogHeader className="relative border-b border-gray-100 pb-4">
            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-8 w-8 sm:hidden text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsDialogOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 pr-8 sm:pr-0">
              <div className="p-2.5 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg">
                {editingValue ? <Edit className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-800">
                  {editingValue
                    ? (language === 'th' ? 'แก้ไขข้อมูล' : 'Edit Data')
                    : (language === 'th' ? 'เพิ่มข้อมูลใหม่' : 'Add New Data')}
                </DialogTitle>
                <DialogDescription className="text-gray-500 mt-0.5">
                  {language === 'th'
                    ? 'กรอกข้อมูลตัวชี้วัด ESG ให้ครบถ้วน'
                    : 'Fill in the ESG metric data completely'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            {/* Own-site scope: show fixed company + site info (read-only) */}
            {dePerm.create_scope === 'own_site' && profile?.site_id ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'บริษัท / สถานที่' : 'Company / Site'}</Label>
                <div className="flex h-12 w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm items-center">
                  <span className="text-gray-800">
                    {profile.company_name && (
                      <span className="font-medium">{profile.company_name} • </span>
                    )}
                    {profile.site_name || getDisplayName(profile.site_id, 'site')}
                    {profile.site_location && (
                      <span className="text-gray-500 ml-1">({profile.site_location})</span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              /* Supervisor/Admin: Select company first, then filter sites */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'บริษัท' : 'Company'} *</Label>
                  <Select
                    value={formCompany}
                    onValueChange={(v) => {
                      setFormCompany(v);
                      setFormData({ ...formData, site_id: '' });
                    }}
                    disabled={!!editingValue || dePerm.create_scope === 'own_company'}
                  >
                    <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-60">
                      <SelectValue placeholder={language === 'th' ? 'เลือกบริษัท' : 'Select company'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                      {companies.map((company) => (
                        <SelectItem key={company.company_id} value={company.company_id}>
                          {company.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'สถานที่' : 'Site'} *</Label>
                  <Select
                    value={formData.site_id}
                    onValueChange={(v) => setFormData({ ...formData, site_id: v })}
                    disabled={!formCompany || !!editingValue}
                  >
                    <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50">
                      <SelectValue placeholder={language === 'th' ? 'เลือกสถานที่' : 'Select site'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                      {formFilteredSites.map((site) => (
                        <SelectItem key={site.site_id} value={site.site_id}>
                          {site.site_name} {site.location && `(${site.location})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Reporting Period — single selector sourced entirely from the
                reporting_period master data (no hardcoded month/year lists,
                and no invalid month×year combinations). */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {language === 'th' ? 'รอบรายงาน (เดือน/ปี)' : 'Reporting Period'} *
              </Label>
              <Select
                value={formData.period_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, period_id: v }))}
                disabled={!!editingValue}
              >
                <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-60">
                  <SelectValue placeholder={language === 'th' ? 'เลือกรอบรายงาน' : 'Select period'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50 max-h-72">
                  {[...periods]
                    .sort((a, b) => b.year - a.year || b.month - a.month)
                    .map((p) => (
                      <SelectItem key={p.period_id} value={p.period_id}>
                        {p.month_name} {p.year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {periods.length === 0 && (
                <p className="text-[11px] text-amber-600">
                  {language === 'th'
                    ? 'ยังไม่มีรอบรายงาน — ผู้ดูแลระบบสร้างได้ที่ Master Data → รอบรายงาน'
                    : 'No reporting periods yet — an admin can add them under Master Data → Reporting Periods'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'มิติ ESG' : 'Dimension'}</Label>
                <Select
                  value={formDimension}
                  onValueChange={(v) => { setFormDimension(v); setFormTheme(''); setFormData({ ...formData, metric_id: '' }); }}
                  disabled={!!editingValue}
                >
                  <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-60">
                    <SelectValue placeholder={language === 'th' ? 'เลือกมิติ' : 'Select dimension'} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                    {dimensions.map((dim) => (
                      <SelectItem key={dim.dimension_id} value={dim.dimension_id}>
                        {dim.dimension_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'หัวข้อ ESG' : 'Theme'}</Label>
              <Select
                value={formTheme}
                onValueChange={(v) => { setFormTheme(v); setFormData({ ...formData, metric_id: '' }); }}
                disabled={!formDimension || !!editingValue}
              >
                <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50">
                  <SelectValue placeholder={language === 'th' ? 'เลือกหัวข้อ' : 'Select theme'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                  {formFilteredThemes.map((theme) => (
                    <SelectItem key={theme.theme_id} value={theme.theme_id}>
                      {theme.theme_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'ตัวชี้วัด' : 'Metric'} *</Label>
              <Select
                value={formData.metric_id}
                onValueChange={(v) => setFormData({ ...formData, metric_id: v })}
                disabled={!formTheme || !!editingValue}
              >
                <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50">
                  <SelectValue placeholder={language === 'th' ? 'เลือกตัวชี้วัด' : 'Select metric'} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                  {formFilteredMetrics.map((metric) => (
                    <SelectItem key={metric.metric_id} value={metric.metric_id}>
                      {metric.metric_name} {metric.unit ? `(${metric.unit})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {existingMatch && !editingValue && (() => {
              const canUpdate = role === 'admin' || role === 'supervisor' || role === 'super_admin';
              return canUpdate ? (
                // supervisor / admin — warn but allow update after confirm
                <div className="rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 rounded-full">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {language === 'th' ? 'มีข้อมูลนี้แล้ว' : 'Record exists'}
                    </Badge>
                    <span className="text-sm text-amber-800">
                      {language === 'th'
                        ? 'มีข้อมูลของ Metric / Site / Period นี้อยู่แล้ว กดบันทึกเพื่อยืนยันการอัปเดต'
                        : 'A record for this combination already exists. Press Save to confirm update.'}
                    </span>
                  </div>
                </div>
              ) : (
                // staff / others — blocked
                <div className="rounded-xl border border-red-300 bg-red-50/70 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-red-100 text-red-700 border-red-300 rounded-full">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {language === 'th' ? 'มีข้อมูลนี้แล้ว' : 'Record already exists'}
                    </Badge>
                    <span className="text-sm text-red-800">
                      {language === 'th'
                        ? 'ไม่สามารถบันทึกซ้ำได้ กรุณาติดต่อ Supervisor หรือ Admin หากต้องการแก้ไข'
                        : 'Cannot save duplicate. Contact a Supervisor or Admin to update this record.'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {editingValue && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 rounded-full">
                    {language === 'th' ? 'โหมดแก้ไข' : 'Edit mode'}
                  </Badge>
                  <span className="text-sm text-amber-800">
                    {language === 'th'
                      ? 'แก้ไขได้เฉพาะค่า / สถานะ / แหล่งข้อมูล / หมายเหตุ — ถ้าต้องการเปลี่ยน Metric/Site/Period ให้ลบแถวนี้แล้วเพิ่มใหม่'
                      : 'Only value/status/data source/remark can be changed. To change Metric/Site/Period, delete this row and create a new one.'}
                  </span>
                </div>
              </div>
            )}

            {(() => {
              const selMetric = metrics.find(m => m.metric_id === formData.metric_id);
              const isAutoMetric = selMetric?.calc_mode === 'auto';
              // Live GHG preview: if the selected metric is an emission-generating
              // ACTIVITY (its code has an emission factor), show the tCO₂e it adds.
              const code = selMetric?.code ?? '';
              const ef = factors.find(f => f.source_code === code);
              const feedsTargets = ghgMappings.filter(g => g.source_code === code).map(g => g.target_code);
              const ghgPreview = ef && feedsTargets.length > 0
                ? {
                    tco2e: (Number(formData.value) * ef.factor_value) / 1000,
                    factor: ef.factor_value,
                    scope: ef.scope,
                    targets: feedsTargets
                      .map(tc => metrics.find(m => m.code === tc)?.metric_name ?? tc),
                  }
                : null;
              return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'ค่า' : 'Value'} *</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                  disabled={isAutoMetric}
                  className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:bg-gray-100 disabled:opacity-70"
                />
                {isAutoMetric && (
                  <p className="text-[11px] text-blue-600 leading-snug">
                    🔒 {language === 'th'
                      ? 'คำนวณอัตโนมัติจากข้อมูลกิจกรรม (GHG) — กรุณากรอก "ค่ากิจกรรม" เช่น ปริมาณดีเซล / ไฟฟ้า ระบบจะคำนวณการปล่อยก๊าซให้เอง'
                      : 'Auto-calculated from activity data (GHG). Enter the activity values (e.g. diesel / electricity) instead — the system computes emissions for you.'}
                  </p>
                )}
                {/* Live GHG preview for activity metrics */}
                {ghgPreview && !isAutoMetric && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 mt-1">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700/70 font-semibold flex items-center gap-1">
                      <span>🌱</span>{language === 'th' ? 'ประมาณการ GHG' : 'Estimated GHG'} · Scope {ghgPreview.scope}
                    </p>
                    <p className="text-sm font-bold text-emerald-700 mt-0.5">
                      ≈ {ghgPreview.tco2e.toLocaleString(undefined, { maximumFractionDigits: 3 })} tCO₂e
                    </p>
                    <p className="text-[10px] text-emerald-700/70 font-mono mt-0.5">
                      {Number(formData.value || 0).toLocaleString()} × {ghgPreview.factor} ÷ 1000
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {language === 'th' ? 'รวมเข้า: ' : 'Feeds into: '}{ghgPreview.targets.join(', ')}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'สถานะ' : 'Status'}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                    <SelectItem value="draft">{language === 'th' ? 'ร่าง' : 'Draft'}</SelectItem>
                    <SelectItem value="submitted">{language === 'th' ? 'ส่ง' : 'Submit'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
              );
            })()}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'แหล่งข้อมูล' : 'Data Source'}</Label>
              <Input
                value={formData.data_source}
                onChange={(e) => setFormData({ ...formData, data_source: e.target.value })}
                placeholder={language === 'th' ? 'ระบุแหล่งที่มาของข้อมูล' : 'Specify data source'}
                className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'หมายเหตุ' : 'Remark'}</Label>
              <Textarea
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder={language === 'th' ? 'หมายเหตุเพิ่มเติม' : 'Additional notes'}
                rows={3}
                className="bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-gray-400 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-4 gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="rounded-xl border-gray-200 hover:bg-gray-100"
            >
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                // Block staff when an existing record is detected
                !!(existingMatch && !editingValue &&
                  role !== 'admin' && role !== 'supervisor' && role !== 'super_admin')
              }
              className="gap-2 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 rounded-xl border-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {language === 'th' ? 'บันทึก' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Update Dialog — supervisor / admin only */}
      <AlertDialog open={confirmUpdateOpen} onOpenChange={setConfirmUpdateOpen}>
        <AlertDialogContent className="glass-card-solid rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              {language === 'th' ? 'มีข้อมูลนี้อยู่แล้ว' : 'Record Already Exists'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  {language === 'th'
                    ? 'พบข้อมูลของ Metric / Site / Period นี้อยู่ในระบบแล้ว'
                    : 'A record for this Metric / Site / Period already exists in the system.'}
                </p>
                {pendingUpdateRecord && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{language === 'th' ? 'ค่าเดิม:' : 'Current value:'}</span>
                      <span className="font-semibold text-gray-800">{pendingUpdateRecord.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{language === 'th' ? 'ค่าใหม่:' : 'New value:'}</span>
                      <span className="font-semibold text-emerald-700">{formData.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className="font-semibold text-gray-800">{pendingUpdateRecord.status} → {formData.status}</span>
                    </div>
                  </div>
                )}
                <p className="font-medium text-amber-700">
                  {language === 'th'
                    ? 'ต้องการอัปเดตข้อมูลเดิมด้วยค่าใหม่นี้หรือไม่?'
                    : 'Do you want to overwrite the existing record with the new values?'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl border-gray-200 hover:bg-gray-100"
              onClick={() => { setConfirmUpdateOpen(false); setPendingUpdateRecord(null); }}
            >
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeConfirmedUpdate}
              className="bg-amber-500 text-white hover:bg-amber-600 rounded-xl shadow-lg"
            >
              {language === 'th' ? 'ยืนยัน อัปเดต' : 'Confirm Update'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="glass-card-solid rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-800">
              {language === 'th' ? 'ยืนยันการลบข้อมูล' : 'Confirm Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              {language === 'th' 
                ? `คุณต้องการลบข้อมูลที่เลือก ${selectedIds.size} รายการหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`
                : `Are you sure you want to delete ${selectedIds.size} selected records? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-gray-200 hover:bg-gray-100">
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              className="bg-red-500 text-white hover:bg-red-600 rounded-xl shadow-lg"
            >
              {language === 'th' ? 'ลบ' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
