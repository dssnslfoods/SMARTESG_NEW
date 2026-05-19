import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Search,
  TrendingUp,
  TrendingDown,
  Loader2,
  CheckCircle2,
  Sparkles,
  X as XIcon,
  ArrowLeft,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TargetCell {
  target_id: string;
  target_value: number;
  target_direction: 'lower_is_better' | 'higher_is_better';
  note: string | null;
}

interface MetricRow {
  metric_id: string;
  metric_name: string;
  unit: string | null;
  theme_name: string;
  dimension_name: string;
  // Current-year target (for selected `year` filter)
  currentTarget?: TargetCell;
  // Long-term target (for configured long-term year)
  longTermTarget?: TargetCell;
}

interface TargetForm {
  currentYearValue: string;
  longTermValue: string;
  target_direction: 'lower_is_better' | 'higher_is_better';
  note: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => THIS_YEAR - 2 + i);

// ─── Component ────────────────────────────────────────────────────────────────
export default function TargetManagement() {
  const { language } = useLanguage();
  const { role, user } = useAuth();
  const { toast } = useToast();
  const th = language === 'th';

  const [year, setYear] = useState(THIS_YEAR);
  const [longTermYear, setLongTermYear] = useState<number>(THIS_YEAR + 5);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDim, setFilterDim] = useState('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricRow | null>(null);
  const [form, setForm] = useState<TargetForm>({
    currentYearValue: '',
    longTermValue: '',
    target_direction: 'lower_is_better',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Deep-link from ESGKeyIssues: ?metric=ID ────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightMetricId = searchParams.get('metric');

  const isManager = role === 'admin' || role === 'supervisor';

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      // First read the configured long-term year so we know which rows to
      // tag as "longTermTarget". Default = currentYear + 5.
      const settingRes = await supabase
        .from('app_setting')
        .select('value')
        .eq('key', 'long_term_target_year')
        .maybeSingle();
      const ltYear = settingRes.data?.value
        ? parseInt(settingRes.data.value, 10)
        : THIS_YEAR + 5;
      setLongTermYear(ltYear);

      // Fetch metrics + the two target rows we care about for each metric.
      const yearsToFetch = ltYear === year ? [year] : [year, ltYear];
      const [metricsRes, targetsRes] = await Promise.all([
        supabase
          .from('esg_metric')
          .select(`
            metric_id, metric_name, unit,
            theme:theme_id (
              theme_name,
              dimension:dimension_id ( dimension_name )
            )
          `),
        supabase.from('metric_target').select('*').in('year', yearsToFetch),
      ]);

      const currentTargetMap = new Map<string, TargetCell>();
      const longTermTargetMap = new Map<string, TargetCell>();
      (targetsRes.data ?? []).forEach((t: any) => {
        const cell: TargetCell = {
          target_id: t.target_id,
          target_value: Number(t.target_value),
          target_direction: t.target_direction,
          note: t.note,
        };
        if (t.year === year) currentTargetMap.set(t.metric_id, cell);
        if (t.year === ltYear) longTermTargetMap.set(t.metric_id, cell);
      });

      const rows: MetricRow[] = (metricsRes.data ?? []).map((m: any) => {
        const theme = m.theme as any;
        const dimension = theme?.dimension as any;
        return {
          metric_id: m.metric_id,
          metric_name: m.metric_name,
          unit: m.unit,
          theme_name: theme?.theme_name ?? '-',
          dimension_name: dimension?.dimension_name ?? '-',
          currentTarget: currentTargetMap.get(m.metric_id),
          longTermTarget: longTermTargetMap.get(m.metric_id),
        };
      });

      const dimSet = new Set(rows.map((r) => r.dimension_name));
      setDimensions(Array.from(dimSet).sort());
      setMetrics(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // ── Highlight & scroll on deep-link arrival ─────────────────────────────────
  useEffect(() => {
    if (!highlightMetricId) return;
    // Make sure the metric is visible — clear dim filter + search
    setFilterDim('all');
    setSearchTerm('');
  }, [highlightMetricId]);

  useEffect(() => {
    if (!highlightMetricId || loading) return;
    // wait for DOM after data renders, then scroll into view
    const timer = setTimeout(() => {
      const el = document.getElementById(`target-row-${highlightMetricId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(timer);
  }, [highlightMetricId, loading]);

  const clearHighlight = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('metric');
    setSearchParams(next, { replace: true });
  };

  const highlightedMetric = useMemo(
    () => (highlightMetricId ? metrics.find((m) => m.metric_id === highlightMetricId) ?? null : null),
    [metrics, highlightMetricId],
  );

  // ── Dialog helpers ─────────────────────────────────────────────────────────
  const openAdd = (m: MetricRow) => {
    setEditingMetric(m);
    setForm({
      currentYearValue: '',
      longTermValue: '',
      target_direction: 'lower_is_better',
      note: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (m: MetricRow) => {
    setEditingMetric(m);
    setForm({
      currentYearValue: m.currentTarget ? String(m.currentTarget.target_value) : '',
      longTermValue: m.longTermTarget ? String(m.longTermTarget.target_value) : '',
      target_direction:
        m.currentTarget?.target_direction ??
        m.longTermTarget?.target_direction ??
        'lower_is_better',
      note: m.currentTarget?.note ?? m.longTermTarget?.note ?? '',
    });
    setDialogOpen(true);
  };

  const validateNum = (s: string): { ok: boolean; n: number } => {
    if (!s.trim()) return { ok: true, n: NaN }; // empty = skip
    const n = parseFloat(s);
    return { ok: !isNaN(n) && n >= 0, n };
  };

  const handleSave = async () => {
    if (!editingMetric) return;

    const cy = validateNum(form.currentYearValue);
    const lt = validateNum(form.longTermValue);
    if (!cy.ok || !lt.ok) {
      toast({
        variant: 'destructive',
        title: th ? 'ข้อผิดพลาด' : 'Error',
        description: th
          ? 'กรุณากรอกค่าเป้าหมายที่ถูกต้อง (ตัวเลข ≥ 0) หรือเว้นว่างเพื่อไม่ตั้ง'
          : 'Please enter valid target values (number ≥ 0), or leave empty to skip',
      });
      return;
    }

    setSaving(true);
    try {
      const note = form.note.trim() || null;
      const direction = form.target_direction;
      const ops: Promise<{ error: any }>[] = [];

      // ── Current-year target ───────────────────────────────────────────
      if (!isNaN(cy.n)) {
        ops.push(
          supabase.from('metric_target').upsert(
            {
              metric_id: editingMetric.metric_id,
              year,
              target_value: cy.n,
              target_direction: direction,
              note,
              created_by: user?.id ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'metric_id,year' },
          ) as any,
        );
      } else if (editingMetric.currentTarget) {
        // User cleared the field — remove the existing row
        ops.push(
          supabase
            .from('metric_target')
            .delete()
            .eq('target_id', editingMetric.currentTarget.target_id) as any,
        );
      }

      // ── Long-term target ─────────────────────────────────────────────
      if (!isNaN(lt.n) && longTermYear !== year) {
        ops.push(
          supabase.from('metric_target').upsert(
            {
              metric_id: editingMetric.metric_id,
              year: longTermYear,
              target_value: lt.n,
              target_direction: direction,
              note,
              created_by: user?.id ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'metric_id,year' },
          ) as any,
        );
      } else if (editingMetric.longTermTarget && isNaN(lt.n)) {
        ops.push(
          supabase
            .from('metric_target')
            .delete()
            .eq('target_id', editingMetric.longTermTarget.target_id) as any,
        );
      }

      const results = await Promise.all(ops);
      const failed = results.find((r) => (r as any).error);
      if (failed) throw new Error((failed as any).error.message);

      toast({
        title: th ? 'สำเร็จ' : 'Success',
        description: th ? 'บันทึกค่าเป้าหมายสำเร็จ' : 'Target saved successfully',
      });
      setDialogOpen(false);
      await fetchData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: th ? 'ข้อผิดพลาด' : 'Error', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: MetricRow) => {
    // Delete BOTH current-year and long-term targets for this metric
    const ids = [m.currentTarget?.target_id, m.longTermTarget?.target_id].filter(
      Boolean,
    ) as string[];
    if (ids.length === 0) return;
    setDeletingId(ids[0]);
    try {
      const { error } = await supabase
        .from('metric_target')
        .delete()
        .in('target_id', ids);
      if (error) throw error;
      toast({
        title: th ? 'สำเร็จ' : 'Deleted',
        description: th ? 'ลบค่าเป้าหมายสำเร็จ' : 'Target deleted',
      });
      await fetchData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: th ? 'ข้อผิดพลาด' : 'Error', description: e.message });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Filtering + grouping ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = metrics;
    if (filterDim !== 'all') rows = rows.filter((r) => r.dimension_name === filterDim);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.metric_name.toLowerCase().includes(q) ||
          r.theme_name.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [metrics, filterDim, searchTerm]);

  // Group: dimension → theme → metrics[]
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, MetricRow[]>>();
    filtered.forEach((r) => {
      if (!map.has(r.dimension_name)) map.set(r.dimension_name, new Map());
      const themeMap = map.get(r.dimension_name)!;
      if (!themeMap.has(r.theme_name)) themeMap.set(r.theme_name, []);
      themeMap.get(r.theme_name)!.push(r);
    });
    return map;
  }, [filtered]);

  // Summary stats
  const stats = useMemo(() => {
    const total = metrics.length;
    const set = metrics.filter((m) => m.currentTarget != null).length;
    const pct = total > 0 ? Math.round((set / total) * 100) : 0;
    return { total, set, pct };
  }, [metrics]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-emerald-600" />
          {th ? 'ตั้งค่าเป้าหมาย KPI' : 'KPI Target Setting'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {th
            ? 'กำหนดค่าเป้าหมายรายปีสำหรับแต่ละ Metric เพื่อติดตามความคืบหน้า ESG'
            : 'Set annual KPI targets per metric to track ESG performance progress'}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            value: stats.total,
            label: th ? 'Metric ทั้งหมด' : 'Total Metrics',
            color: 'text-foreground',
          },
          {
            value: stats.set,
            label: th ? 'ตั้งเป้าหมายแล้ว' : 'Targets Set',
            color: 'text-emerald-600',
          },
          {
            value: `${stats.pct}%`,
            label: th ? 'ความครบถ้วน' : 'Coverage',
            color:
              stats.pct >= 80
                ? 'text-emerald-600'
                : stats.pct >= 50
                ? 'text-amber-600'
                : 'text-muted-foreground',
          },
        ].map((s) => (
          <Card key={s.label} className="glass-card-solid">
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contextual banner — when arriving via ?metric=ID deep link */}
      {highlightMetricId && (
        <Card className="border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2 shrink-0">
              <Target className="h-5 w-5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {th ? '🎯 มาตั้งค่าเป้าหมายให้:' : '🎯 Setting target for:'}
              </p>
              {highlightedMetric ? (
                <p className="text-xs text-amber-800/90 truncate mt-0.5">
                  <span className="font-mono mr-1.5 opacity-70">{highlightedMetric.metric_id}</span>
                  <span className="font-medium">{highlightedMetric.metric_name}</span>
                  <span className="ml-2 text-amber-700/70 inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {highlightedMetric.theme_name} · {highlightedMetric.dimension_name}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-amber-800/70 mt-0.5 italic">
                  <span className="font-mono">{highlightMetricId}</span>{' '}
                  {th ? '(ไม่พบในรายการ — อาจถูกลบไปแล้ว)' : '(not found — may have been removed)'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                asChild
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Link to={`/esg-key-issues?metric=${encodeURIComponent(highlightMetricId)}`}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {th ? 'กลับไปดูตัวชี้วัด' : 'Back to Metric'}
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearHighlight}
                title={th ? 'ปิดการเน้น' : 'Clear highlight'}
                className="h-8 w-8 p-0 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + Table */}
      <Card className="glass-card-solid">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Year */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">{th ? 'ปี' : 'Year'}</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dimension */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">{th ? 'มิติ' : 'Dimension'}</Label>
              <Select value={filterDim} onValueChange={setFilterDim}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{th ? 'ทั้งหมด' : 'All Dimensions'}</SelectItem>
                  {dimensions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={th ? 'ค้นหา Metric...' : 'Search metric...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-3 sm:px-6 pt-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {th ? 'ไม่พบ Metric ที่ตรงกัน' : 'No matching metrics found'}
            </div>
          ) : (
            <div className="space-y-7">
              {Array.from(grouped.entries()).map(([dimName, themeMap]) => (
                <div key={dimName}>
                  {/* Dimension heading */}
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                      {dimName}
                    </span>
                    <div className="flex-1 h-px bg-emerald-100" />
                  </div>

                  <div className="space-y-4">
                    {Array.from(themeMap.entries()).map(([themeName, themeMetrics]) => (
                      <div key={themeName}>
                        <p className="text-xs text-muted-foreground font-medium px-1 mb-1.5">
                          {themeName}
                        </p>
                        <div className="rounded-xl border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="text-xs">
                                  {th ? 'ชื่อ Metric' : 'Metric'}
                                </TableHead>
                                <TableHead className="text-xs w-32 hidden sm:table-cell">
                                  {th ? 'หน่วย' : 'Unit'}
                                </TableHead>
                                <TableHead className="text-xs w-32">
                                  {th ? `เป้าหมาย ${year}` : `Target ${year}`}
                                </TableHead>
                                <TableHead className="text-xs w-36 hidden sm:table-cell">
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-amber-500" />
                                    {th ? `ระยะยาว ${longTermYear}` : `Long-Term ${longTermYear}`}
                                  </span>
                                </TableHead>
                                <TableHead className="text-xs w-40 hidden md:table-cell">
                                  {th ? 'ทิศทาง' : 'Direction'}
                                </TableHead>
                                <TableHead className="text-xs hidden lg:table-cell">
                                  {th ? 'หมายเหตุ' : 'Note'}
                                </TableHead>
                                {isManager && (
                                  <TableHead className="text-xs w-24 text-right">
                                    {th ? 'จัดการ' : 'Actions'}
                                  </TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {themeMetrics.map((m) => {
                                const hasAnyTarget = !!(m.currentTarget || m.longTermTarget);
                                const direction =
                                  m.currentTarget?.target_direction ??
                                  m.longTermTarget?.target_direction;
                                const note = m.currentTarget?.note ?? m.longTermTarget?.note;
                                const deletingForRow =
                                  deletingId === m.currentTarget?.target_id ||
                                  deletingId === m.longTermTarget?.target_id;
                                return (
                                <TableRow
                                  key={m.metric_id}
                                  id={`target-row-${m.metric_id}`}
                                  className={
                                    m.metric_id === highlightMetricId
                                      ? 'bg-amber-100/60 outline outline-2 outline-amber-400 -outline-offset-[2px] hover:bg-amber-100/70'
                                      : hasAnyTarget
                                        ? 'bg-emerald-50/30'
                                        : ''
                                  }
                                >
                                  <TableCell className="text-xs font-medium py-2.5">
                                    <div>
                                      {m.metric_name}
                                      <span className="sm:hidden text-muted-foreground ml-1">
                                        ({m.unit ?? '-'})
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                                    {m.unit ?? '-'}
                                  </TableCell>
                                  {/* Current-year target */}
                                  <TableCell className="text-xs">
                                    {m.currentTarget ? (
                                      <span className="font-bold text-emerald-700">
                                        {m.currentTarget.target_value.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/50 italic text-[11px]">
                                        {th ? 'ยังไม่ตั้ง' : 'Not set'}
                                      </span>
                                    )}
                                  </TableCell>
                                  {/* Long-term target */}
                                  <TableCell className="text-xs hidden sm:table-cell">
                                    {m.longTermTarget ? (
                                      <span className="font-bold text-amber-700">
                                        {m.longTermTarget.target_value.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/50 italic text-[11px]">
                                        {th ? 'ยังไม่ตั้ง' : 'Not set'}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {direction ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-xs gap-1 ${
                                          direction === 'higher_is_better'
                                            ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                            : 'border-blue-200 text-blue-700 bg-blue-50'
                                        }`}
                                      >
                                        {direction === 'higher_is_better' ? (
                                          <>
                                            <TrendingUp className="h-3 w-3" />
                                            {th ? 'ยิ่งสูงยิ่งดี' : 'Higher Better'}
                                          </>
                                        ) : (
                                          <>
                                            <TrendingDown className="h-3 w-3" />
                                            {th ? 'ยิ่งต่ำยิ่งดี' : 'Lower Better'}
                                          </>
                                        )}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground/40 text-xs">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-52 truncate hidden lg:table-cell">
                                    {note || '—'}
                                  </TableCell>
                                  {isManager && (
                                    <TableCell className="text-right py-2">
                                      <div className="flex justify-end items-center gap-1">
                                        {m.metric_id === highlightMetricId && (
                                          <Button
                                            asChild
                                            size="sm"
                                            className="h-7 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm whitespace-nowrap"
                                          >
                                            <Link
                                              to={`/esg-key-issues?metric=${encodeURIComponent(m.metric_id)}`}
                                            >
                                              <ArrowLeft className="h-3 w-3" />
                                              {th ? 'กลับ' : 'Back'}
                                            </Link>
                                          </Button>
                                        )}
                                        {hasAnyTarget ? (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 w-7 p-0"
                                              onClick={() => openEdit(m)}
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                              disabled={deletingForRow}
                                              onClick={() => handleDelete(m)}
                                            >
                                              {deletingForRow ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-3.5 w-3.5" />
                                              )}
                                            </Button>
                                          </>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                            onClick={() => openAdd(m)}
                                          >
                                            <Plus className="h-3 w-3 mr-0.5" />
                                            {th ? 'ตั้งค่า' : 'Set'}
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card-solid max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              {editingMetric?.currentTarget || editingMetric?.longTermTarget
                ? th
                  ? 'แก้ไขค่าเป้าหมาย'
                  : 'Edit Target'
                : th
                  ? 'ตั้งค่าเป้าหมายใหม่'
                  : 'Set New Target'}
            </DialogTitle>
          </DialogHeader>

          {editingMetric && (
            <div className="space-y-4 py-2">
              {/* Metric info card */}
              <div className="rounded-xl bg-muted/40 px-4 py-3 border border-border/50">
                <p className="text-[11px] text-muted-foreground">
                  {editingMetric.dimension_name} › {editingMetric.theme_name}
                </p>
                <p className="text-sm font-semibold mt-0.5">{editingMetric.metric_name}</p>
                {editingMetric.unit && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {th ? 'หน่วย: ' : 'Unit: '}
                    <span className="font-medium text-foreground">{editingMetric.unit}</span>
                  </p>
                )}
              </div>

              {/* Target value */}
              <div className="space-y-1.5">
                <Label>
                  {th ? `ค่าเป้าหมายปี ${year}` : `Target Value for ${year}`}
                </Label>
                <Input
                  type="number"
                  value={form.currentYearValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currentYearValue: e.target.value }))
                  }
                  placeholder={th ? 'เว้นว่าง = ไม่ตั้ง' : 'Leave empty to skip'}
                  min="0"
                  step="any"
                  autoFocus
                />
              </div>

              {/* Long-term target value */}
              {longTermYear !== year && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    {th
                      ? `เป้าหมายระยะยาว ปี ${longTermYear}`
                      : `Long-Term Target (${longTermYear})`}
                  </Label>
                  <Input
                    type="number"
                    value={form.longTermValue}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, longTermValue: e.target.value }))
                    }
                    placeholder={
                      th ? 'เว้นว่าง = ไม่ตั้งระยะยาว' : 'Leave empty to skip long-term'
                    }
                    min="0"
                    step="any"
                    className="border-amber-200 focus-visible:ring-amber-300"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    {th
                      ? `บันทึกเป็น metric_target ปี ${longTermYear} แยกจากเป้าหมายปีปัจจุบัน`
                      : `Saved as a separate metric_target row for ${longTermYear}`}
                  </p>
                </div>
              )}

              {/* Direction */}
              <div className="space-y-1.5">
                <Label>{th ? 'ทิศทางที่ดีกว่า' : 'Target Direction'}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['lower_is_better', th ? '↓ ยิ่งต่ำยิ่งดี' : '↓ Lower is Better', 'blue'] as const,
                      ['higher_is_better', th ? '↑ ยิ่งสูงยิ่งดี' : '↑ Higher is Better', 'emerald'] as const,
                    ] as const
                  ).map(([val, label, color]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, target_direction: val }))}
                      className={`rounded-xl border px-3 py-3 text-sm text-left font-medium transition-all ${
                        form.target_direction === val
                          ? color === 'emerald'
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                            : 'border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/30'
                      }`}
                    >
                      <span>{label}</span>
                      <p className="text-[11px] font-normal mt-0.5 opacity-70">
                        {val === 'lower_is_better'
                          ? th
                            ? 'เช่น GHG, ขยะ, น้ำใช้'
                            : 'e.g. GHG, waste, water'
                          : th
                          ? 'เช่น พลังงานหมุนเวียน, ชั่วโมงอบรม'
                          : 'e.g. renewable energy, training hrs'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label>
                  {th ? 'หมายเหตุ' : 'Note'}{' '}
                  <span className="text-muted-foreground text-xs">({th ? 'ไม่บังคับ' : 'optional'})</span>
                </Label>
                <Input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder={
                    th ? 'เช่น ลดจากปีที่แล้ว 10%' : 'e.g. Reduce 10% from last year'
                  }
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  {th ? 'ยกเลิก' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    (!form.currentYearValue.trim() &&
                      !form.longTermValue.trim() &&
                      !editingMetric?.currentTarget &&
                      !editingMetric?.longTermTarget)
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {th ? 'บันทึก' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
