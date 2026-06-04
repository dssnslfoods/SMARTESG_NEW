import { useEffect, useState, useMemo } from 'react';
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
import { Cloud, Plus, Trash2, Loader2, Calculator, Factory, Save } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Metric { metric_id: string; metric_name: string; unit: string | null; code: string | null; calc_mode: string; theme_id: string; }
interface Theme { theme_id: string; dimension_id: string | null; }
interface Dimension { dimension_id: string; dimension_name: string; }

// A metric whose unit looks like a CO₂-equivalent is a GHG OUTPUT (a target),
// not an emission-generating activity.
const isCO2e = (unit: string | null) => !!unit && /co2e/i.test(unit);
interface EmissionFactor { factor_id: string; source_code: string; scope: number; factor_value: number; factor_unit: string | null; source: string | null; }
interface Mapping { mapping_id: string; target_code: string; source_code: string; }

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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // new factor draft
  const [newF, setNewF] = useState({ source_code: '', scope: '1', factor_value: '', factor_unit: '', source: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mRes, thRes, dRes, fRes, gRes] = await Promise.all([
        supabase.from('esg_metric').select('metric_id, metric_name, unit, code, calc_mode, theme_id').order('metric_name'),
        supabase.from('esg_theme').select('theme_id, dimension_id'),
        supabase.from('esg_dimension').select('dimension_id, dimension_name'),
        supabase.from('emission_factor').select('*').order('scope'),
        supabase.from('ghg_calc_mapping').select('*'),
      ]);
      setMetrics((mRes.data ?? []) as Metric[]);
      setThemes((thRes.data ?? []) as Theme[]);
      setDimensions((dRes.data ?? []) as Dimension[]);
      setFactors((fRes.data ?? []) as EmissionFactor[]);
      setMappings((gRes.data ?? []) as Mapping[]);
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

  // ── Emission factor: add ──────────────────────────────────────────────────
  const addFactor = async () => {
    if (!tenantId || !newF.source_code || !newF.factor_value) {
      toast({ title: th ? 'กรอกข้อมูลไม่ครบ' : 'Missing fields', description: th ? 'เลือกกิจกรรมและใส่ค่า Factor' : 'Pick an activity and enter a factor', variant: 'destructive' });
      return;
    }
    setBusy('add-factor');
    try {
      const { error } = await supabase.from('emission_factor').upsert({
        tenant_id: tenantId,
        source_code: newF.source_code,
        scope: Number(newF.scope),
        factor_value: Number(newF.factor_value),
        factor_unit: newF.factor_unit || null,
        source: newF.source || null,
      }, { onConflict: 'tenant_id,source_code' });
      if (error) throw error;
      setNewF({ source_code: '', scope: '1', factor_value: '', factor_unit: '', source: '' });
      await fetchAll();
      toast({ title: th ? 'บันทึกสำเร็จ' : 'Saved' });
    } catch (e: any) {
      toast({ title: th ? 'ผิดพลาด' : 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const deleteFactor = async (factor_id: string) => {
    setBusy(factor_id);
    try {
      const { error } = await supabase.from('emission_factor').delete().eq('factor_id', factor_id);
      if (error) throw error;
      await fetchAll();
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
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="h-4 w-4 text-amber-600" />
            {th ? 'ค่าสัมประสิทธิ์การปล่อย (Emission Factors)' : 'Emission Factors'}
          </CardTitle>
          <CardDescription className="text-xs">
            {th ? 'kgCO₂e ต่อหน่วยกิจกรรม เช่น ดีเซล 2.7406 kgCO₂e/ลิตร (อ้างอิง TGO)' : 'kgCO₂e per activity unit, e.g. diesel 2.7406 kgCO₂e/L (TGO reference)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* existing factors */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">{th ? 'กิจกรรม' : 'Activity'}</th>
                  <th className="pb-2 font-medium">Scope</th>
                  <th className="pb-2 font-medium text-right">{th ? 'ค่า Factor' : 'Factor'}</th>
                  <th className="pb-2 font-medium">{th ? 'หน่วย' : 'Unit'}</th>
                  <th className="pb-2 font-medium">{th ? 'แหล่งอ้างอิง' : 'Source'}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {factors.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-xs text-muted-foreground italic">{th ? 'ยังไม่มี Emission Factor' : 'No emission factors yet'}</td></tr>
                )}
                {factors.map(f => (
                  <tr key={f.factor_id} className="text-slate-700">
                    <td className="py-2 font-medium">{nameForCode(f.source_code)}<span className="text-[10px] text-muted-foreground/60 font-mono ml-1">{f.source_code}</span></td>
                    <td className="py-2"><Badge variant="outline" className={`text-[10px] ${SCOPE_BADGE[f.scope]}`}>Scope {f.scope}</Badge></td>
                    <td className="py-2 text-right font-mono">{f.factor_value}</td>
                    <td className="py-2 text-muted-foreground">{f.factor_unit}</td>
                    <td className="py-2 text-xs text-muted-foreground">{f.source}</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" disabled={busy === f.factor_id} onClick={() => deleteFactor(f.factor_id)}>
                        {busy === f.factor_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* add new factor */}
          <div className="rounded-xl border border-dashed border-border p-3 grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
            <div className="sm:col-span-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{th ? 'กิจกรรม' : 'Activity'}</label>
              <Select value={newF.source_code} onValueChange={(v) => {
                const m = metricByCode.get(v);
                setNewF(p => ({ ...p, source_code: v, factor_unit: m?.unit ? `kgCO2e/${m.unit}` : p.factor_unit }));
              }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={th ? 'เลือกกิจกรรม' : 'Select activity'} /></SelectTrigger>
                <SelectContent>
                  {activityMetrics.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground italic">{th ? 'ไม่มีกิจกรรมด้านสิ่งแวดล้อม' : 'No environmental activities'}</div>
                  )}
                  {activityMetrics.map(m => (
                    <SelectItem key={m.metric_id} value={m.code!}>{m.metric_name}{m.unit ? ` (${m.unit})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Scope</label>
              <Select value={newF.scope} onValueChange={(v) => setNewF(p => ({ ...p, scope: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Scope 1</SelectItem>
                  <SelectItem value="2">Scope 2</SelectItem>
                  <SelectItem value="3">Scope 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{th ? 'ค่า Factor' : 'Factor'}</label>
              <Input type="number" step="any" value={newF.factor_value} onChange={(e) => setNewF(p => ({ ...p, factor_value: e.target.value }))} className="h-9 text-xs" placeholder="2.7406" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{th ? 'หน่วย' : 'Unit'}</label>
              <Input value={newF.factor_unit} onChange={(e) => setNewF(p => ({ ...p, factor_unit: e.target.value }))} className="h-9 text-xs" placeholder="kgCO2e/L" />
            </div>
            <div className="flex gap-1.5">
              <Input value={newF.source} onChange={(e) => setNewF(p => ({ ...p, source: e.target.value }))} className="h-9 text-xs flex-1" placeholder={th ? 'อ้างอิง' : 'Source'} />
              <Button size="sm" className="h-9 gap-1 shrink-0" disabled={busy === 'add-factor'} onClick={addFactor}>
                {busy === 'add-factor' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
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
                      {[...factorCodes].length === 0 && (
                        <span className="text-[11px] text-amber-600 italic">{th ? 'ยังไม่มี Emission Factor — เพิ่มด้านบนก่อน' : 'No emission factors yet — add one above first'}</span>
                      )}
                      {[...factorCodes].map(code => {
                        const checked = targetSources.includes(code);
                        const cellId = `${target.code}:${code}`;
                        return (
                          <label key={code} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 cursor-pointer text-xs transition ${checked ? 'border-emerald-400 bg-white' : 'border-border bg-white/60 hover:bg-white'}`}>
                            <Checkbox checked={checked} disabled={busy === cellId} onCheckedChange={(v) => toggleMapping(target.code!, code, !!v)} />
                            {nameForCode(code)}
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
