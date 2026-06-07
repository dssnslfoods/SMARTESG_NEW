import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Cloud, Plus, Trash2, Loader2, Calculator, Factory, Save, Upload, Download, FileSpreadsheet } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Metric { metric_id: string; metric_name: string; unit: string | null; code: string | null; calc_mode: string; theme_id: string; }
interface Theme { theme_id: string; dimension_id: string | null; }
interface Dimension { dimension_id: string; dimension_name: string; }

// A metric whose unit looks like a CO₂-equivalent is a GHG OUTPUT (a target),
// not an emission-generating activity.
const isCO2e = (unit: string | null) => !!unit && /co2e/i.test(unit);
interface EmissionFactor {
  factor_id: string; source_code: string; scope: number; factor_value: number;
  factor_unit: string | null; source: string | null;
  activity_name_th?: string | null; activity_name_en?: string | null;
  reference_detail?: string | null; effective_year?: number | null; active?: boolean | null;
}
interface Mapping { mapping_id: string; target_code: string; source_code: string; }
interface RefRow {
  ref_id: string; activity_code: string; activity_name_th: string | null; activity_name_en: string | null;
  scope: number | null; factor: number | null; unit: string | null; source: string | null;
  reference_detail: string | null; effective_year: number | null; active: boolean | null;
}

// ─── Fuzzy name matching (guide EF from the reference library) ──────────────────
const normalize = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/[()_\-/.,:]/g, ' ').replace(/\s+/g, ' ').trim();

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prevDiag = tmp;
    }
  }
  return prev[b.length];
}
function strRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  return max === 0 ? 0 : 1 - levenshtein(a, b) / max;
}

export default function GhgSettings() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const th = language === 'th';
  const { toast } = useToast();
  const tenantId = profile?.tenant_id ?? null;

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [refs, setRefs] = useState<RefRow[]>([]);          // imported reference library
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showRefs, setShowRefs] = useState(false);

  // Per-activity editable EF draft, keyed by activity code: { value, unit, scope }
  const [efDraft, setEfDraft] = useState<Record<string, { value: string; unit: string; scope: string }>>({});
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mRes, thRes, dRes, fRes, gRes, rRes] = await Promise.all([
        supabase.from('esg_metric').select('metric_id, metric_name, unit, code, calc_mode, theme_id').order('metric_name'),
        supabase.from('esg_theme').select('theme_id, dimension_id'),
        supabase.from('esg_dimension').select('dimension_id, dimension_name'),
        supabase.from('emission_factor').select('*').order('scope'),
        supabase.from('ghg_calc_mapping').select('*'),
        supabase.from('emission_factor_reference').select('*'),
      ]);
      setMetrics((mRes.data ?? []) as Metric[]);
      setThemes((thRes.data ?? []) as Theme[]);
      setDimensions((dRes.data ?? []) as Dimension[]);
      setFactors((fRes.data ?? []) as EmissionFactor[]);
      setMappings((gRes.data ?? []) as Mapping[]);
      setRefs((rRes.data ?? []) as RefRow[]);
    } catch (e) {
      console.error('GhgSettings fetch error:', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  // metric → dimension name (via theme)
  const dimNameByMetric = useMemo(() => {
    const themeDim = new Map(themes.map(t => [t.theme_id, t.dimension_id]));
    const dimName = new Map(dimensions.map(d => [d.dimension_id, d.dimension_name]));
    const map = new Map<string, string>();
    metrics.forEach(m => {
      const did = themeDim.get(m.theme_id) ?? null;
      map.set(m.metric_id, did ? (dimName.get(did) ?? '') : '');
    });
    return map;
  }, [metrics, themes, dimensions]);

  const metricByCode = useMemo(() => new Map(metrics.map(m => [m.code ?? '', m])), [metrics]);
  const factorCodes = useMemo(() => new Set(factors.map(f => f.source_code)), [factors]);
  const factorByCode = useMemo(() => new Map(factors.map(f => [f.source_code, f])), [factors]);

  // Closest reference-library row for a system activity (exact code → fuzzy name).
  const bestRefMatch = (m: Metric): { ref: RefRow; score: number } | null => {
    if (refs.length === 0) return null;
    const mTh = normalize(m.metric_name);
    const mCode = (m.code ?? '').toUpperCase();
    let best: RefRow | null = null;
    let bestScore = 0;
    for (const r of refs) {
      if (r.active === false) continue;
      if (r.activity_code && mCode && r.activity_code.toUpperCase() === mCode) return { ref: r, score: 1 };
      const cands = [
        r.activity_name_th, r.activity_name_en,
        [r.activity_name_th, r.activity_name_en].filter(Boolean).join(' '),
      ].map(normalize).filter(Boolean);
      let s = 0;
      for (const c of cands) s = Math.max(s, strRatio(mTh, c));
      if (s > bestScore) { bestScore = s; best = r; }
    }
    return best ? { ref: best, score: bestScore } : null;
  };

  // Emission-generating ACTIVITIES (sources): Environment-dimension metrics that
  // have a code and aren't themselves a GHG output (CO₂e) metric.
  const activityMetrics = useMemo(
    () => metrics.filter(m =>
      m.code && !isCO2e(m.unit) && dimNameByMetric.get(m.metric_id) === 'Environment'),
    [metrics, dimNameByMetric],
  );
  // GHG OUTPUT metrics (targets): unit is a CO₂-equivalent.
  const targetMetrics = useMemo(
    () => metrics.filter(m => m.code && isCO2e(m.unit)),
    [metrics],
  );

  const nameForCode = (code: string) => {
    const m = metricByCode.get(code);
    return m ? m.metric_name : code;
  };

  // ── Excel: column order shared by template / export / import ────────────────
  const EF_COLUMNS = [
    'activity_code', 'activity_name_th', 'activity_name_en', 'scope', 'factor',
    'unit', 'source', 'reference_detail', 'effective_year', 'active',
  ];

  // Build an .xlsx workbook (README + EmissionFactors sheet) and download it.
  const buildAndDownload = async (rows: any[][], filename: string) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const readme = XLSX.utils.aoa_to_sheet([
      ['GHG Emission Factor — Import/Export'],
      ['1 แถว = 1 emission factor · KEY = activity_code (UPPER_SNAKE_CASE) · ระบบ match การคำนวณด้วย code นี้'],
      ['สูตร: GHG (kgCO2e) = activity_value × factor   →   tCO2e = ÷ 1000'],
      ['คอลัมน์: ' + EF_COLUMNS.join(', ')],
      ['scope = 1/2/3 · active = TRUE/FALSE · factor เป็นตัวเลขล้วน (ไม่มีหน่วย)'],
    ]);
    XLSX.utils.book_append_sheet(wb, readme, 'README');
    const ws = XLSX.utils.aoa_to_sheet([EF_COLUMNS, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'EmissionFactors');
    XLSX.writeFile(wb, filename);
  };

  const exportFactors = async () => {
    // Export the reference library (round-trips with import).
    const rows = refs.map(r => [
      r.activity_code, r.activity_name_th ?? '', r.activity_name_en ?? '',
      r.scope ?? '', r.factor ?? '', r.unit ?? '', r.source ?? '',
      r.reference_detail ?? '', r.effective_year ?? '',
      r.active === false ? 'FALSE' : 'TRUE',
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    await buildAndDownload(rows, `GHG_EmissionFactor_Reference_${stamp}.xlsx`);
  };

  const downloadTemplate = async () => {
    // A couple of TGO reference rows so users see the expected format.
    const sample = [
      ['DIESEL_FLEET', 'ปริมาณการใช้น้ำมันดีเซล (ยานพาหนะ)', 'Diesel Consumption (mobile)', 1, 2.7406, 'kgCO2e/L', 'TGO 2022', 'IPCC 2006 vol.2', 2022, 'TRUE'],
      ['GRID_ELECTRICITY', 'ปริมาณการใช้ไฟฟ้าจากโครงข่าย', 'Grid Electricity', 2, 0.4999, 'kgCO2e/kWh', 'TGO Grid Mix', 'TGO grid emission factor', 2022, 'TRUE'],
    ];
    await buildAndDownload(sample, 'GHG_EmissionFactor_Template.xlsx');
  };

  // Parse the uploaded workbook and upsert factors by (tenant, activity_code).
  const importFactors = async (file: File) => {
    if (!tenantId) return;
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      // Prefer the EmissionFactors sheet; else the first sheet containing activity_code.
      let aoa: any[][] | null = null;
      const sheetNames = [...wb.SheetNames].sort(n => (/emission|factor/i.test(n) ? -1 : 1));
      for (const name of sheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as any[][];
        if (rows.some(r => r.some(c => String(c).trim().toLowerCase() === 'activity_code'))) { aoa = rows; break; }
      }
      if (!aoa) throw new Error(th ? 'ไม่พบคอลัมน์ activity_code ในไฟล์' : 'No "activity_code" column found in the file');

      const headerIdx = aoa.findIndex(r => r.some(c => String(c).trim().toLowerCase() === 'activity_code'));
      const headers = aoa[headerIdx].map(c => String(c).trim().toLowerCase());
      const col = (name: string) => headers.indexOf(name);
      const cAct = col('activity_code'), cFactor = col('factor'), cScope = col('scope'),
        cUnit = col('unit'), cSource = col('source'), cTh = col('activity_name_th'),
        cEn = col('activity_name_en'), cRef = col('reference_detail'),
        cYear = col('effective_year'), cActive = col('active');

      const seen = new Set<string>();
      const upserts: any[] = [];
      let skipped = 0;
      for (const r of aoa.slice(headerIdx + 1)) {
        const code = String(r[cAct] ?? '').trim().toUpperCase();
        const factor = Number(r[cFactor]);
        if (!code || !Number.isFinite(factor)) { skipped++; continue; }
        if (seen.has(code)) { skipped++; continue; } // de-dupe within the file
        seen.add(code);
        const scope = cScope >= 0 ? (parseInt(String(r[cScope]), 10) || 1) : 1;
        upserts.push({
          tenant_id: tenantId,
          activity_code: code,
          scope: scope >= 1 && scope <= 3 ? scope : 1,
          factor,
          unit: cUnit >= 0 ? String(r[cUnit] ?? '').trim() || null : null,
          source: cSource >= 0 ? String(r[cSource] ?? '').trim() || null : null,
          activity_name_th: cTh >= 0 ? String(r[cTh] ?? '').trim() || null : null,
          activity_name_en: cEn >= 0 ? String(r[cEn] ?? '').trim() || null : null,
          reference_detail: cRef >= 0 ? String(r[cRef] ?? '').trim() || null : null,
          effective_year: cYear >= 0 && r[cYear] !== '' ? (parseInt(String(r[cYear]), 10) || null) : null,
          active: cActive >= 0 ? !/^(false|0|no|n)$/i.test(String(r[cActive]).trim()) : true,
        });
      }
      if (upserts.length === 0) throw new Error(th ? 'ไม่พบแถวข้อมูลที่ใช้ได้' : 'No valid rows to import');

      const existing = new Set(refs.map(r => r.activity_code));
      const inserted = upserts.filter(u => !existing.has(u.activity_code)).length;
      const updated = upserts.length - inserted;

      // Import populates the REFERENCE library — a lookup source for guiding EFs,
      // not the active factors the GHG calc uses.
      const { error } = await supabase
        .from('emission_factor_reference')
        .upsert(upserts, { onConflict: 'tenant_id,activity_code' });
      if (error) throw error;

      await fetchAll();
      setShowRefs(true);
      toast({
        title: th ? 'นำเข้าตารางอ้างอิงสำเร็จ' : 'Reference imported',
        description: th
          ? `เพิ่ม ${inserted} · อัปเดต ${updated}${skipped ? ` · ข้าม ${skipped}` : ''} รายการอ้างอิง`
          : `${inserted} added · ${updated} updated${skipped ? ` · ${skipped} skipped` : ''} reference rows`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: th ? 'นำเข้าไม่สำเร็จ' : 'Import failed', description: e.message });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Emission factor: add ──────────────────────────────────────────────────
  // Effective EF view for one activity row: the saved factor if any, otherwise
  // the value guided from the closest reference-library match.
  const efFor = (m: Metric) => {
    const current = m.code ? factorByCode.get(m.code) ?? null : null;
    const match = bestRefMatch(m);
    const draft = m.code ? efDraft[m.code] : undefined;
    const value = draft?.value ?? (current ? String(current.factor_value) : (match?.ref.factor != null ? String(match.ref.factor) : ''));
    const unit = draft?.unit ?? (current?.factor_unit ?? match?.ref.unit ?? (m.unit ? `kgCO2e/${m.unit}` : ''));
    const scope = draft?.scope ?? (current ? String(current.scope) : String(match?.ref.scope ?? 1));
    return { current, match, value, unit, scope };
  };

  // Save the (edited or suggested) EF for one activity into emission_factor.
  const saveActivityFactor = async (m: Metric) => {
    if (!tenantId || !m.code) return;
    const { current, match, value, unit, scope } = efFor(m);
    const num = Number(value);
    if (!Number.isFinite(num) || value === '') {
      toast({ title: th ? 'ใส่ค่า Factor เป็นตัวเลข' : 'Enter a numeric factor', variant: 'destructive' });
      return;
    }
    setBusy('save-' + m.code);
    try {
      const { error } = await supabase.from('emission_factor').upsert({
        tenant_id: tenantId,
        source_code: m.code,
        scope: Number(scope) || 1,
        factor_value: num,
        factor_unit: unit || null,
        source: current?.source ?? match?.ref.source ?? null,
      }, { onConflict: 'tenant_id,source_code' });
      if (error) throw error;
      await fetchAll();
      setEfDraft(p => { const n = { ...p }; delete n[m.code!]; return n; });
      toast({ title: th ? 'บันทึกค่า EF แล้ว' : 'EF saved' });
    } catch (e: any) {
      toast({ title: th ? 'ผิดพลาด' : 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  // Activities that currently show a (numeric) suggested value but aren't saved.
  const suggestedRows = useMemo(
    () => activityMetrics.filter(m => {
      if (!m.code || factorByCode.has(m.code)) return false; // already saved
      const draft = efDraft[m.code];
      const match = bestRefMatch(m);
      const value = draft?.value ?? (match?.ref.factor != null ? String(match.ref.factor) : '');
      return value !== '' && Number.isFinite(Number(value));
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activityMetrics, factorByCode, efDraft, refs],
  );

  // Save every suggested (unsaved) activity factor in one batch.
  const saveAllSuggested = async () => {
    if (!tenantId || suggestedRows.length === 0) return;
    setBusy('save-all');
    try {
      const rows = suggestedRows.map(m => {
        const { value, unit, scope, match } = efFor(m);
        return {
          tenant_id: tenantId,
          source_code: m.code,
          scope: Number(scope) || 1,
          factor_value: Number(value),
          factor_unit: unit || null,
          source: match?.ref.source ?? null,
        };
      });
      const { error } = await supabase.from('emission_factor').upsert(rows, { onConflict: 'tenant_id,source_code' });
      if (error) throw error;
      setEfDraft({});
      await fetchAll();
      toast({ title: th ? `บันทึก ${rows.length} รายการที่แนะนำแล้ว` : `Saved ${rows.length} suggested factors` });
    } catch (e: any) {
      toast({ title: th ? 'ผิดพลาด' : 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };


  // ── Toggle a metric's calc_mode ───────────────────────────────────────────
  const setCalcMode = async (metric: Metric, auto: boolean) => {
    setBusy(metric.metric_id);
    try {
      const { error } = await supabase.from('esg_metric')
        .update({ calc_mode: auto ? 'auto' : 'manual' })
        .eq('metric_id', metric.metric_id);
      if (error) throw error;
      setMetrics(prev => prev.map(m => m.metric_id === metric.metric_id ? { ...m, calc_mode: auto ? 'auto' : 'manual' } : m));
    } catch (e: any) {
      toast({ title: th ? 'ผิดพลาด' : 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  // ── Toggle a source for a target mapping ──────────────────────────────────
  const toggleMapping = async (target_code: string, source_code: string, on: boolean) => {
    if (!tenantId) return;
    setBusy(`${target_code}:${source_code}`);
    try {
      if (on) {
        const { error } = await supabase.from('ghg_calc_mapping')
          .upsert({ tenant_id: tenantId, target_code, source_code }, { onConflict: 'tenant_id,target_code,source_code' });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ghg_calc_mapping').delete()
          .eq('tenant_id', tenantId).eq('target_code', target_code).eq('source_code', source_code);
        if (error) throw error;
      }
      await fetchAll();
    } catch (e: any) {
      toast({ title: th ? 'ผิดพลาด' : 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const SCOPE_BADGE: Record<number, string> = {
    1: 'bg-red-100 text-red-700 border-red-200',
    2: 'bg-amber-100 text-amber-700 border-amber-200',
    3: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Cloud className="h-6 w-6 text-emerald-600" />
          {th ? 'ตั้งค่าการคำนวณ GHG' : 'GHG Calculation Settings'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">
          {th
            ? 'กำหนดค่า Emission Factor และให้ระบบคำนวณการปล่อยก๊าซเรือนกระจกอัตโนมัติจากข้อมูลกิจกรรม — มีผลเฉพาะ tenant ของคุณ'
            : 'Define emission factors and let the system auto-calculate GHG emissions from activity data — applies to your tenant only.'}
        </p>
      </div>

      {/* ── Section 1: Emission Factors ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Factory className="h-4 w-4 text-amber-600" />
                {th ? 'ค่าสัมประสิทธิ์การปล่อย (Emission Factors)' : 'Emission Factors'}
              </CardTitle>
              <CardDescription className="text-xs">
                {th ? 'kgCO₂e ต่อหน่วยกิจกรรม เช่น ดีเซล 2.7406 kgCO₂e/ลิตร (อ้างอิง TGO)' : 'kgCO₂e per activity unit, e.g. diesel 2.7406 kgCO₂e/L (TGO reference)'}
              </CardDescription>
            </div>
            {/* Excel import / export — match factors by activity_code */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importFactors(f); }}
              />
              <div className="flex flex-col items-end gap-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  {th ? 'คลังอ้างอิง EF (Excel)' : 'EF Reference Library (Excel)'}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-1.5">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-white" onClick={downloadTemplate}>
                    <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
                    {th ? 'ดาวน์โหลดเทมเพลต' : 'Template'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-white" onClick={exportFactors} disabled={refs.length === 0}>
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    {th ? 'ส่งออกอ้างอิง' : 'Export Reference'}
                  </Button>
                  <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {th ? 'นำเข้าอ้างอิง' : 'Import Reference'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* How it works */}
          <p className="text-[11px] text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {th
              ? 'ตารางด้านล่างคือ “กิจกรรมของระบบ” ระบบจะ guide ค่า EF จากคลังอ้างอิงที่นำเข้า (จับคู่ด้วยชื่อใกล้เคียงที่สุด) — ค่าที่เป็น “suggested” ยังไม่ถูกใช้ ต้องกด Save ก่อน · ค่าที่ “saved” เท่านั้นที่ระบบใช้คำนวณ GHG'
              : 'The table below lists your system activities. The system guides each EF from the imported reference library (closest-name match) — “suggested” values are NOT used until you Save; only “saved” values feed the GHG calc.'}
          </p>

          {/* Save-all-suggested bar — only when there are unsaved suggestions */}
          {suggestedRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-xs text-amber-800">
                {th
                  ? `มี ${suggestedRows.length} กิจกรรมที่มีค่าแนะนำแต่ยังไม่ได้บันทึก — ตรวจค่าให้ถูกก่อนบันทึก`
                  : `${suggestedRows.length} activities have a suggested value that isn’t saved — review before saving`}
              </span>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                disabled={busy === 'save-all'}
                onClick={saveAllSuggested}
              >
                {busy === 'save-all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {th ? `บันทึกค่าแนะนำทั้งหมด (${suggestedRows.length})` : `Save all suggested (${suggestedRows.length})`}
              </Button>
            </div>
          )}

          {/* Activity-based EF table (guided + editable) */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">{th ? 'กิจกรรมของระบบ' : 'System Activity'}</th>
                  <th className="pb-2 font-medium">{th ? 'แนะนำจากอ้างอิง' : 'Guided from reference'}</th>
                  <th className="pb-2 font-medium w-24">Scope</th>
                  <th className="pb-2 font-medium w-28 text-right">{th ? 'ค่า EF' : 'EF value'}</th>
                  <th className="pb-2 font-medium w-32">{th ? 'หน่วย' : 'Unit'}</th>
                  <th className="pb-2 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activityMetrics.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-xs text-muted-foreground italic">{th ? 'ไม่มีกิจกรรมด้านสิ่งแวดล้อมในระบบ' : 'No environmental activities in the system'}</td></tr>
                )}
                {activityMetrics.map(m => {
                  const { current, match, value, unit, scope } = efFor(m);
                  const code = m.code!;
                  const pct = match ? Math.round(match.score * 100) : 0;
                  const matchColor = pct >= 85 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-slate-400';
                  return (
                    <tr key={m.metric_id} className="text-slate-700 align-top">
                      <td className="py-2 pr-2">
                        <span className="font-medium">{m.metric_name}</span>
                        <span className="block text-[10px] text-muted-foreground/60 font-mono">{code}{m.unit ? ` · ${m.unit}` : ''}</span>
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        {match ? (
                          <span className="inline-flex flex-col">
                            <span className="text-slate-600">{match.ref.activity_name_th || match.ref.activity_name_en || match.ref.activity_code}</span>
                            <span className="text-[10px]">
                              <span className={`font-semibold ${matchColor}`}>{pct === 100 ? (th ? 'ตรงรหัส' : 'code match') : `${pct}%`}</span>
                              {match.ref.factor != null && <span className="text-muted-foreground"> · {match.ref.factor} {match.ref.unit}</span>}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 italic">{refs.length === 0 ? (th ? 'ยังไม่ import อ้างอิง' : 'no reference yet') : (th ? 'ไม่พบที่ใกล้เคียง' : 'no close match')}</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <Select value={scope} onValueChange={(v) => setEfDraft(p => ({ ...p, [code]: { value, unit, scope: v } }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Scope 1</SelectItem>
                            <SelectItem value="2">Scope 2</SelectItem>
                            <SelectItem value="3">Scope 3</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number" step="any" value={value}
                          onChange={(e) => setEfDraft(p => ({ ...p, [code]: { value: e.target.value, unit, scope } }))}
                          className="h-8 text-xs text-right font-mono" placeholder="—"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          value={unit}
                          onChange={(e) => setEfDraft(p => ({ ...p, [code]: { value, unit: e.target.value, scope } }))}
                          className="h-8 text-xs" placeholder="kgCO2e/L"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {current
                            ? <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-700 bg-emerald-50">{th ? 'บันทึกแล้ว' : 'saved'}</Badge>
                            : value !== '' && <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700 bg-amber-50">{th ? 'แนะนำ' : 'suggested'}</Badge>}
                          <Button size="sm" className="h-7 px-2 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy === 'save-' + code} onClick={() => saveActivityFactor(m)}>
                            {busy === 'save-' + code ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Reference library (read-only, imported from Excel) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60">
            <button
              type="button"
              onClick={() => setShowRefs(s => !s)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {th ? `ตารางอ้างอิง (Reference Library)` : 'Reference Library'} · {refs.length}
              </span>
              <span>{showRefs ? '▲' : '▼'}</span>
            </button>
            {showRefs && (
              <div className="overflow-x-auto border-t border-slate-200 px-3 pb-3 pt-1">
                {refs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-3">{th ? 'ยังไม่มีข้อมูลอ้างอิง — กด “นำเข้า Excel”' : 'No reference rows yet — click “Import Excel”.'}</p>
                ) : (
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="text-left text-[10px] text-muted-foreground border-b">
                        <th className="py-1.5 font-medium">activity_code</th>
                        <th className="py-1.5 font-medium">{th ? 'ชื่อ' : 'name'}</th>
                        <th className="py-1.5 font-medium">scope</th>
                        <th className="py-1.5 font-medium text-right">factor</th>
                        <th className="py-1.5 font-medium">unit</th>
                        <th className="py-1.5 font-medium">source</th>
                        <th className="py-1.5 font-medium">year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {refs.map(r => (
                        <tr key={r.ref_id} className="text-slate-600">
                          <td className="py-1.5 font-mono text-[11px]">{r.activity_code}</td>
                          <td className="py-1.5">{r.activity_name_th || r.activity_name_en || '—'}</td>
                          <td className="py-1.5">{r.scope ?? '—'}</td>
                          <td className="py-1.5 text-right font-mono">{r.factor ?? '—'}</td>
                          <td className="py-1.5 text-muted-foreground">{r.unit ?? '—'}</td>
                          <td className="py-1.5 text-muted-foreground">{r.source ?? '—'}</td>
                          <td className="py-1.5">{r.effective_year ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Auto-calc setup ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-600" />
            {th ? 'การคำนวณ GHG อัตโนมัติ' : 'GHG Auto-Calculation'}
          </CardTitle>
          <CardDescription className="text-xs">
            {th ? 'เปิดโหมดอัตโนมัติให้ตัวชี้วัด GHG แล้วเลือกว่ารวมจากกิจกรรมใดบ้าง (ระบบคูณด้วย Emission Factor ให้)' : 'Turn a GHG metric to auto, then pick which activities it sums (the system multiplies by the emission factor).'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {targetMetrics.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">{th ? 'ไม่พบตัวชี้วัด GHG (หน่วย tCO₂e)' : 'No GHG output metrics (tCO₂e unit) found'}</p>
          )}
          {targetMetrics.map(target => {
            const isAuto = target.calc_mode === 'auto';
            const targetSources = mappings.filter(m => m.target_code === target.code).map(m => m.source_code);
            return (
              <div key={target.metric_id} className={`rounded-xl border p-3 ${isAuto ? 'border-emerald-200 bg-emerald-50/40' : 'border-border'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{target.metric_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{target.code} {target.unit && `· ${target.unit}`}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground">{isAuto ? (th ? 'อัตโนมัติ' : 'Auto') : (th ? 'กรอกเอง' : 'Manual')}</span>
                    <Switch checked={isAuto} disabled={busy === target.metric_id} onCheckedChange={(v) => setCalcMode(target, v)} className="data-[state=checked]:bg-emerald-600" />
                  </div>
                </div>

                {/* source picker — only when auto */}
                {isAuto && (
                  <div className="mt-3 pt-3 border-t border-emerald-200/60">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{th ? 'รวมจากกิจกรรม (ที่มี Emission Factor)' : 'Sum from activities (with an emission factor)'}</p>
                    <div className="flex flex-wrap gap-2">
                      {activityMetrics.filter(m => factorCodes.has(m.code ?? '')).length === 0 && (
                        <span className="text-[11px] text-amber-600 italic">{th ? 'ยังไม่มีกิจกรรมที่บันทึกค่า EF — ตั้งค่าด้านบนก่อน' : 'No activities with a saved EF yet — set one above first'}</span>
                      )}
                      {activityMetrics
                        .filter(m => m.code && factorCodes.has(m.code))
                        .map(m => {
                          const code = m.code!;
                          const checked = targetSources.includes(code);
                          const cellId = `${target.code}:${code}`;
                          return (
                            <label key={code} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 cursor-pointer text-xs transition ${checked ? 'border-emerald-400 bg-white' : 'border-border bg-white/60 hover:bg-white'}`}>
                              <Checkbox checked={checked} disabled={busy === cellId} onCheckedChange={(v) => toggleMapping(target.code!, code, !!v)} />
                              {m.metric_name}
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-2">
        {th
          ? '💡 เมื่อเปิดโหมดอัตโนมัติ ค่าของตัวชี้วัด GHG จะถูกคำนวณใหม่ทันทีที่มีการกรอก/แก้ไขข้อมูลกิจกรรม'
          : '💡 In auto mode, the GHG metric is recomputed instantly whenever its activity data is entered or changed.'}
      </p>
    </div>
  );
}
