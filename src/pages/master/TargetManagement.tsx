import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MetricRow {
  metric_id: string;
  metric_name: string;
  unit: string | null;
  theme_name: string;
  dimension_name: string;
  // target fields (optional — may not exist yet)
  target_id?: string;
  target_value?: number;
  target_direction?: 'lower_is_better' | 'higher_is_better';
  note?: string;
}

interface TargetForm {
  target_value: string;
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
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDim, setFilterDim] = useState('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricRow | null>(null);
  const [form, setForm] = useState<TargetForm>({
    target_value: '',
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
        supabase
          .from('metric_target')
          .select('*')
          .eq('year', year),
      ]);

      const targetMap = new Map(
        (targetsRes.data ?? []).map((t: any) => [t.metric_id, t]),
      );

      const rows: MetricRow[] = (metricsRes.data ?? []).map((m: any) => {
        const theme = m.theme as any;
        const dimension = theme?.dimension as any;
        const tgt = targetMap.get(m.metric_id) as any | undefined;
        return {
          metric_id: m.metric_id,
          metric_name: m.metric_name,
          unit: m.unit,
          theme_name: theme?.theme_name ?? '-',
          dimension_name: dimension?.dimension_name ?? '-',
          ...(tgt
            ? {
                target_id: tgt.target_id,
                target_value: Number(tgt.target_value),
                target_direction: tgt.target_direction,
                note: tgt.note,
              }
            : {}),
        };
      });

      // Unique dimension names for filter
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
    setForm({ target_value: '', target_direction: 'lower_is_better', note: '' });
    setDialogOpen(true);
  };

  const openEdit = (m: MetricRow) => {
    setEditingMetric(m);
    setForm({
      target_value: String(m.target_value ?? ''),
      target_direction: m.target_direction ?? 'lower_is_better',
      note: m.note ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingMetric) return;
    const val = parseFloat(form.target_value);
    if (isNaN(val) || val < 0) {
      toast({
        variant: 'destructive',
        title: th ? 'ข้อผิดพลาด' : 'Error',
        description: th ? 'กรุณากรอกค่าเป้าหมายที่ถูกต้อง (ตัวเลข ≥ 0)' : 'Please enter a valid target value (number ≥ 0)',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        metric_id: editingMetric.metric_id,
        year,
        target_value: val,
        target_direction: form.target_direction,
        note: form.note.trim() || null,
        created_by: user?.id ?? null,
      };

      if (editingMetric.target_id) {
        const { error } = await supabase
          .from('metric_target')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('target_id', editingMetric.target_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('metric_target').insert(payload);
        if (error) throw error;
      }

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
    if (!m.target_id) return;
    setDeletingId(m.target_id);
    try {
      const { error } = await supabase
        .from('metric_target')
        .delete()
        .eq('target_id', m.target_id);
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
    const set = metrics.filter((m) => m.target_id != null).length;
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
            <Button
              size="sm"
              variant="ghost"
              onClick={clearHighlight}
              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 gap-1 shrink-0"
            >
              <XIcon className="h-3.5 w-3.5" />
              {th ? 'ปิด' : 'Clear'}
            </Button>
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
                                <TableHead className="text-xs w-36">
                                  {th ? `เป้าหมาย ${year}` : `Target ${year}`}
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
                              {themeMetrics.map((m) => (
                                <TableRow
                                  key={m.metric_id}
                                  id={`target-row-${m.metric_id}`}
                                  className={
                                    m.metric_id === highlightMetricId
                                      ? 'bg-amber-100/60 outline outline-2 outline-amber-400 -outline-offset-[2px] hover:bg-amber-100/70'
                                      : m.target_id
                                        ? 'bg-emerald-50/30'
                                        : ''
                                  }
                                >
                                  <TableCell className="text-xs font-medium py-2.5">
                                    <div>
                                      {m.metric_name}
                                      {/* Unit on mobile */}
                                      <span className="sm:hidden text-muted-foreground ml-1">
                                        ({m.unit ?? '-'})
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                                    {m.unit ?? '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {m.target_value != null ? (
                                      <span className="font-bold text-emerald-700">
                                        {m.target_value.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/50 italic text-[11px]">
                                        {th ? 'ยังไม่ตั้ง' : 'Not set'}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {m.target_direction ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-xs gap-1 ${
                                          m.target_direction === 'higher_is_better'
                                            ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                            : 'border-blue-200 text-blue-700 bg-blue-50'
                                        }`}
                                      >
                                        {m.target_direction === 'higher_is_better' ? (
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
                                    {m.note || '—'}
                                  </TableCell>
                                  {isManager && (
                                    <TableCell className="text-right py-2">
                                      <div className="flex justify-end gap-1">
                                        {m.target_id ? (
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
                                              disabled={deletingId === m.target_id}
                                              onClick={() => handleDelete(m)}
                                            >
                                              {deletingId === m.target_id ? (
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
                              ))}
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
              {editingMetric?.target_id
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
                  {th ? `ค่าเป้าหมายปี ${year}` : `Target Value for ${year}`}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  value={form.target_value}
                  onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
                  placeholder="0"
                  min="0"
                  step="any"
                  autoFocus
                />
              </div>

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
                  disabled={saving || !form.target_value}
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
