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
import { Plus, Edit, Trash2, Save, FileText, Building2, MapPin, Calendar, BarChart3, CheckSquare, Square, X, Leaf, TrendingUp, Clock, Filter, AlertTriangle, Database } from "lucide-react";
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
import { fetchMetricValuesFull, fetchTotalCount, FETCH_CONFIG } from "@/lib/dataFetcher";
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
  const [totalDbCount, setTotalDbCount] = useState<number>(0); // Actual count in database
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number | null }>({ loaded: 0, total: null });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<MetricValue | null>(null);
  const [existingMatch, setExistingMatch] = useState<MetricValue | null>(null);
  const [prefilledFromExisting, setPrefilledFromExisting] = useState(false);
  const latestLookupKeyRef = useRef<string | null>(null);

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

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 15;

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
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setLoadProgress({ loaded: 0, total: null });
    try {
      // First, get the actual count from database using optimized fetcher
      const dbCount = await fetchTotalCount();
      setTotalDbCount(dbCount);
      setLoadProgress(prev => ({ ...prev, total: dbCount }));

      // Use optimized fetcher with larger batch size for 100K+ records
      const [
        { data: sitesData },
        { data: companiesData },
        { data: periodsData },
        { data: dimensionsData },
        { data: themesData },
        { data: metricsData },
        valuesData,
      ] = await Promise.all([
        supabase.from('site').select('*').order('site_name'),
        supabase.from('company').select('*').order('company_name'),
        supabase.from('reporting_period').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('esg_dimension').select('*').order('dimension_name'),
        supabase.from('esg_theme').select('*').order('theme_name'),
        supabase.from('esg_metric').select('*').order('metric_name'),
        fetchMetricValuesFull({ 
          pageSize: FETCH_CONFIG.PAGE_SIZE,
          onProgress: (loaded) => setLoadProgress(prev => ({ ...prev, loaded })),
        }),
      ]);

      setSites(sitesData || []);
      setCompanies(companiesData || []);
      setPeriods(periodsData || []);
      setDimensions(dimensionsData || []);
      setThemes(themesData || []);
      setMetrics(metricsData || []);
      setMetricValues(valuesData.map(v => ({
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
      })));
      
      // Invalidate cache after data modification
      invalidateMetricValueCache();
      
      if (FETCH_CONFIG.DEBUG_MODE) {
        console.log(`[DataEntry] Loaded ${valuesData.length} metric values (DB total: ${dbCount})`);
      }
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
    setExistingMatch(null);
    setPrefilledFromExisting(false);
    setFormCompany('');
    setFormDimension('');
    setFormTheme('');
    setFormMonth('');
    setFormYear('');
    
    // For staff role, auto-set site_id from profile
    const staffSiteId = role === 'staff' && profile?.site_id ? profile.site_id : '';
    
    setFormData({
      value_id: generateValueId(),
      site_id: staffSiteId,
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
      fetchAllData();
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
      existingRecord = await findExistingOnBackend(formData.site_id, formData.period_id, formData.metric_id);
    } catch {
      existingRecord = null;
    }

    if (existingRecord && !editingValue) {
      // If we already auto-loaded that record into the form, update without prompting.
      if (prefilledFromExisting && existingMatch?.value_id === existingRecord.value_id) {
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
          .eq('value_id', existingRecord.value_id);

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
            entityId: existingRecord.value_id,
            beforeData: existingRecord,
            afterData: { ...existingRecord, ...dataToUpdate },
          });
          toast({
            title: language === 'th' ? 'สำเร็จ' : 'Success',
            description: language === 'th' ? 'อัปเดตข้อมูลสำเร็จ' : 'Data updated successfully',
          });
          setIsDialogOpen(false);
          fetchAllData();
        }
        return;
      }

      // Record exists - ask user if they want to update it
      const confirmUpdate = confirm(
        language === 'th' 
          ? 'มีข้อมูลสำหรับ Metric, Site และ Period นี้อยู่แล้ว ต้องการอัปเดตข้อมูลเดิมหรือไม่?' 
          : 'A record for this Metric, Site, and Period already exists. Do you want to update it?'
      );
      
      if (!confirmUpdate) {
        return;
      }
      
      // Update existing record
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
        .eq('value_id', existingRecord.value_id);

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
          entityId: existingRecord.value_id,
          beforeData: existingRecord,
          afterData: { ...existingRecord, ...dataToUpdate },
        });
        toast({
          title: language === 'th' ? 'สำเร็จ' : 'Success',
          description: language === 'th' ? 'อัปเดตข้อมูลสำเร็จ' : 'Data updated successfully',
        });
        setIsDialogOpen(false);
        fetchAllData();
      }
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
      submitted_by: user.id,
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
      // Use upsert to handle duplicate key gracefully at database level
      // This works even when RLS prevents SELECT of the existing record
      const { data: upsertedData, error: upsertError } = await supabase
        .from('metric_value')
        .upsert(dataToSave, { 
          onConflict: 'metric_id,site_id,period_id',
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
          <Button 
            onClick={handleCreate} 
            className="gap-2 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-xl px-6 py-2.5 border-0"
          >
            <Plus className="h-4 w-4" />
            {language === 'th' ? 'เพิ่มข้อมูล' : 'Add Data'}
          </Button>
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
                  ? `แสดง ${metricValues.length} จาก ${totalDbCount} รายการ (RLS อาจซ่อนบางรายการ)` 
                  : `Showing ${metricValues.length} of ${totalDbCount} records (RLS may hide some records)`}
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
            <p className="text-3xl font-bold text-gray-800">{totalDbCount}</p>
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
            <p className="text-3xl font-bold text-gray-800">{metricValues.length}</p>
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
            <p className="text-3xl font-bold text-gray-800">{metricValues.filter(v => v.status === 'draft').length}</p>
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
            <p className="text-3xl font-bold text-gray-800">{metricValues.filter(v => v.status === 'submitted').length}</p>
            <p className="text-xs text-blue-600 mt-1">{language === 'th' ? 'เสร็จสิ้น' : 'completed'}</p>
          </CardContent>
        </Card>
      </div>

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

          <div className="mt-4 flex flex-col gap-2">
            <div className="text-xs text-gray-500">
              {language === 'th'
                ? `ทั้งหมด ${metricValues.length} รายการ • หลังกรอง ${filteredValues.length} รายการ`
                : `Total ${metricValues.length} • After filters ${filteredValues.length}`}
            </div>

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
                {filteredValues.length} {language === 'th' ? 'รายการ' : 'records'}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(value)}
                            className="h-8 w-8 rounded-lg hover:bg-emerald-100 hover:text-emerald-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(value.value_id)}
                            className="h-8 w-8 rounded-lg hover:bg-red-100 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
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
            {/* Staff: Show fixed company + site info (read-only) */}
            {role === 'staff' && profile?.site_id ? (
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
                  >
                    <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
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
                    disabled={!formCompany}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'เดือน' : 'Month'} *</Label>
                <Select
                  value={formMonth}
                  onValueChange={(v) => {
                    setFormMonth(v);
                    if (formYear) {
                      const matched = periods.find(p => p.month === Number(v) && p.year === Number(formYear));
                      setFormData(prev => ({ ...prev, period_id: matched?.period_id || '' }));
                    }
                  }}
                >
                  <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                    <SelectValue placeholder={language === 'th' ? 'เลือกเดือน' : 'Select month'} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                    {Array.from(new Map(periods.map(p => [p.month, p])).values())
                      .sort((a, b) => a.month - b.month)
                      .map((p) => (
                        <SelectItem key={p.month} value={String(p.month)}>
                          {p.month_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'ปี' : 'Year'} *</Label>
                <Select
                  value={formYear}
                  onValueChange={(v) => {
                    setFormYear(v);
                    if (formMonth) {
                      const matched = periods.find(p => p.month === Number(formMonth) && p.year === Number(v));
                      setFormData(prev => ({ ...prev, period_id: matched?.period_id || '' }));
                    }
                  }}
                >
                  <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                    <SelectValue placeholder={language === 'th' ? 'เลือกปี' : 'Select year'} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-xl rounded-xl z-50">
                    {Array.from(new Set(periods.map(p => p.year)))
                      .sort((a, b) => b - a)
                      .map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'มิติ ESG' : 'Dimension'}</Label>
                <Select
                  value={formDimension}
                  onValueChange={(v) => { setFormDimension(v); setFormTheme(''); setFormData({ ...formData, metric_id: '' }); }}
                >
                  <SelectTrigger className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all">
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
                disabled={!formDimension}
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
                disabled={!formTheme}
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

            {existingMatch && !editingValue && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full">
                    {language === 'th' ? 'พบข้อมูลเดิม' : 'Existing record found'}
                  </Badge>
                  <span className="text-sm text-emerald-800">
                    {language === 'th'
                      ? 'ระบบดึงค่าที่บันทึกไว้แล้วมาแสดงในฟอร์ม (กดบันทึกเพื่ออัปเดต)'
                      : 'Loaded saved values into the form (Save to update).'}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{language === 'th' ? 'ค่า' : 'Value'} *</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                  className="h-12 bg-white/80 backdrop-blur border-gray-200 rounded-xl hover:border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
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
              className="gap-2 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 rounded-xl border-0"
            >
              <Save className="h-4 w-4" />
              {language === 'th' ? 'บันทึก' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
