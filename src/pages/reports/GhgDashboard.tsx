import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Cloud, Factory, Zap, TrendingDown, TrendingUp, Target, RefreshCcw, Loader2, Info, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, ReferenceLine,
} from 'recharts';

interface GhgSummary {
  year: number; prev_year: number; current_month: number; unit: string; tenant: string;
  has_scope3: boolean;
  ytd: { scope1: number; scope2: number; scope3: number; total: number };
  prev_ytd: { total: number };
  monthly: Array<{ month: string; scope1: number; scope2: number; scope3: number }>;
  by_site: Array<{ site: string; scope1: number; scope2: number; scope3: number; total: number }>;
  yearly: Array<{ year: number; scope1: number; scope2: number; scope3: number; total: number }>;
  target: { scope1: number | null; scope2: number | null; scope3: number | null };
}

const S1 = '#ef4444'; // scope 1 — red
const S2 = '#f59e0b'; // scope 2 — amber
const S3 = '#3b82f6'; // scope 3 — blue

function fmt(n: number): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// Small (i) tooltip used on every card to explain how to read it.
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] whitespace-pre-line text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

export default function GhgDashboard() {
  const { language } = useLanguage();
  const th = language === 'th';
  const [data, setData] = useState<GhgSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data: res, error } = await supabase.rpc('get_ghg_summary');
      if (error) throw error;
      setData(res as GhgSummary);
    } catch (e) {
      console.error('GHG dashboard error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return null;

  const has3 = !!data.has_scope3;
  const months = th
    ? ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const reportingPeriod = `${months[0]}–${months[data.current_month - 1]} ${data.year}`;

  const totalTarget = (data.target.scope1 ?? 0) + (data.target.scope2 ?? 0) + (has3 ? (data.target.scope3 ?? 0) : 0);
  const yoy = data.prev_ytd.total > 0
    ? ((data.ytd.total - data.prev_ytd.total) / data.prev_ytd.total) * 100
    : null;
  const yoyGood = yoy != null && yoy <= 0; // lower emissions is better

  const donut = [
    { name: th ? 'Scope 1 (ทางตรง)' : 'Scope 1 (direct)', value: data.ytd.scope1, color: S1 },
    { name: th ? 'Scope 2 (ไฟฟ้า)' : 'Scope 2 (electricity)', value: data.ytd.scope2, color: S2 },
    ...(has3 ? [{ name: th ? 'Scope 3 (ทางอ้อมอื่น)' : 'Scope 3 (other indirect)', value: data.ytd.scope3, color: S3 }] : []),
  ];
  const monthlyChart = data.monthly.map(m => ({ ...m, label: m.month.slice(2) }));
  const yearlyChart = data.yearly.map(y => ({
    year: String(y.year),
    scope1: y.scope1, scope2: y.scope2, scope3: y.scope3,
  }));

  const scopeLabel = (n: string) => (n === 'scope1' ? 'Scope 1' : n === 'scope2' ? 'Scope 2' : 'Scope 3');
  const totalLabel = has3 ? (th ? 'รวมทุก Scope (YTD)' : 'Total all scopes (YTD)') : (th ? 'รวม Scope 1+2 (YTD)' : 'Total Scope 1+2 (YTD)');

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Cloud className="h-6 w-6 text-emerald-600" />
            {th ? 'การปล่อยก๊าซเรือนกระจก (GHG)' : 'GHG Emissions'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.tenant} · {th ? 'ช่วงรายงาน' : 'Reporting period'}: {reportingPeriod} · {th ? 'หน่วย' : 'unit'}: tCO₂e
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing} className="gap-1.5">
          <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {th ? 'รีเฟรช' : 'Refresh'}
        </Button>
      </div>

      {/* KPI cards */}
      <div className={`grid grid-cols-2 gap-3 ${has3 ? 'md:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <KpiCard icon={Cloud}   color="from-slate-700 to-slate-900"  label={totalLabel}
                 value={fmt(data.ytd.total)} sub="tCO₂e"
                 tip={th ? 'ผลรวมการปล่อย GHG ของทุก Scope สะสมตั้งแต่ต้นปีถึงเดือนปัจจุบัน (YTD) — ตัวเลขรวมที่ใช้รายงานภาพรวม' : 'Sum of GHG across all scopes, year-to-date (Jan→current month). The headline total.'} />
        <KpiCard icon={Factory} color="from-red-500 to-rose-600"     label={th ? 'Scope 1 — ทางตรง' : 'Scope 1 — Direct'}
                 value={fmt(data.ytd.scope1)} sub="tCO₂e"
                 tip={th ? 'การปล่อยทางตรงจากแหล่งที่องค์กรเป็นเจ้าของ/ควบคุม เช่น เผาไหม้น้ำมันดีเซลในรถ/เครื่องจักร' : 'Direct emissions from sources you own/control — e.g. burning diesel in vehicles/machinery.'} />
        <KpiCard icon={Zap}     color="from-amber-500 to-orange-600" label={th ? 'Scope 2 — ไฟฟ้า' : 'Scope 2 — Electricity'}
                 value={fmt(data.ytd.scope2)} sub="tCO₂e"
                 tip={th ? 'การปล่อยทางอ้อมจากพลังงานที่ซื้อมาใช้ เช่น ไฟฟ้าจากโครงข่าย (คำนวณจากปริมาณไฟฟ้า × emission factor)' : 'Indirect emissions from purchased energy, e.g. grid electricity (kWh × emission factor).'} />
        {has3 && (
          <KpiCard icon={Layers} color="from-blue-500 to-indigo-600" label={th ? 'Scope 3 — ทางอ้อมอื่น' : 'Scope 3 — Other indirect'}
                   value={fmt(data.ytd.scope3)} sub="tCO₂e"
                   tip={th ? 'การปล่อยทางอ้อมอื่น ๆ ในห่วงโซ่คุณค่า เช่น ของเสีย น้ำ การขนส่งภายนอก พนักงานเดินทาง' : 'Other indirect value-chain emissions — e.g. waste, water, outsourced transport, business travel.'} />
        )}
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardContent className="p-3.5">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                {th ? 'เทียบปีก่อน (YoY)' : 'Year-over-Year'}
                <InfoTip text={th ? 'เปรียบเทียบ YTD ปีนี้กับช่วงเดียวกันของปีก่อน · ค่าติดลบ = ปล่อยลดลง (ดี) · บวก = เพิ่มขึ้น' : 'This year’s YTD vs the same period last year. Negative = emissions fell (good); positive = rose.'} />
              </p>
              <div className={`rounded-lg p-1.5 ${yoyGood ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {yoyGood ? <TrendingDown className="h-3.5 w-3.5 text-emerald-600" /> : <TrendingUp className="h-3.5 w-3.5 text-red-600" />}
              </div>
            </div>
            <p className={`text-2xl font-bold leading-none ${yoy == null ? 'text-slate-400' : yoyGood ? 'text-emerald-600' : 'text-red-600'}`}>
              {yoy == null ? '—' : `${yoy > 0 ? '+' : ''}${yoy.toFixed(1)}%`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5">{th ? 'การปล่อยก๊าซ — ยิ่งลดยิ่งดี' : 'Emissions — lower is better'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Scope breakdown donut + Net Zero trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-emerald-500" />{th ? 'สัดส่วนตาม Scope (YTD)' : 'Breakdown by Scope (YTD)'}
              <span className="ml-auto"><InfoTip text={th ? 'สัดส่วน % ของการปล่อยแต่ละ Scope ในยอดรวม YTD — ช่วยดูว่าแหล่งปล่อยหลักมาจาก Scope ไหน' : 'Each scope’s share of the YTD total — shows where most emissions come from.'} /></span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative" style={{ height: 190 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donut} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2}>
                    {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <ReTooltip formatter={(v: number) => [`${fmt(v)} tCO₂e`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-bold text-slate-900">{fmt(data.ytd.total)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">tCO₂e</p>
              </div>
            </div>
            <div className="space-y-1.5 mt-1">
              <Row color={S1} label={th ? 'Scope 1 (ทางตรง)' : 'Scope 1 (direct)'} value={data.ytd.scope1} total={data.ytd.total} />
              <Row color={S2} label={th ? 'Scope 2 (ไฟฟ้า)' : 'Scope 2 (electricity)'} value={data.ytd.scope2} total={data.ytd.total} />
              {has3 && <Row color={S3} label={th ? 'Scope 3 (ทางอ้อมอื่น)' : 'Scope 3 (other indirect)'} value={data.ytd.scope3} total={data.ytd.total} />}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />{th ? 'เส้นทางสู่ Net Zero (รายปี)' : 'Net-Zero Trajectory (yearly)'}
              <span className="ml-auto"><InfoTip text={th ? 'แท่งซ้อนรายปี แยกสีตาม Scope (แดง=1 เหลือง=2 น้ำเงิน=3) · ความสูงรวม = การปล่อยรวมทั้งปี · เส้นประ = เป้าหมายรวมปีปัจจุบัน — แท่งควรลดลงเข้าหาเส้นเป้าเพื่อมุ่งสู่ Net Zero' : 'Yearly stacked bars by scope (red=1, amber=2, blue=3); total height = total emissions · dashed line = current-year total target. Bars should trend down toward the target.'} /></span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <ComposedChart data={yearlyChart} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                  <ReTooltip formatter={(v: number, n: string) => [`${fmt(v)} tCO₂e`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="scope1" name="Scope 1" stackId="y" fill={S1} maxBarSize={56} />
                  <Bar dataKey="scope2" name="Scope 2" stackId="y" fill={S2} maxBarSize={56} radius={has3 ? undefined : [6, 6, 0, 0]} />
                  {has3 && <Bar dataKey="scope3" name="Scope 3" stackId="y" fill={S3} maxBarSize={56} radius={[6, 6, 0, 0]} />}
                  {totalTarget > 0 && (
                    <ReferenceLine
                      y={totalTarget} stroke="#0f766e" strokeWidth={2} strokeDasharray="6 4" ifOverflow="extendDomain"
                      label={{
                        value: `${th ? 'เป้า ≤' : 'below'} ${fmt(totalTarget)} tCO₂e (${data.year})`,
                        position: 'insideTopRight', fill: '#0f766e', fontSize: 11, fontWeight: 700,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              {th ? '🎯 เส้นประแนวนอน = เพดานเป้าหมายรวมปีปัจจุบัน · แท่งซ้อน = การปล่อยจริงรายปีแยกตาม Scope' : '🎯 Dashed horizontal line = current-year target cap · stacked bars = actual yearly emissions by scope'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly stacked + by site */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5 text-blue-500" />{th ? `รายเดือน (12 เดือน) — ${has3 ? 'ทุก Scope' : 'Scope 1+2'}` : `Monthly (12 mo) — ${has3 ? 'all scopes' : 'Scope 1+2'}`}
              <span className="ml-auto"><InfoTip text={th ? 'แนวโน้มการปล่อยรายเดือน 12 เดือนล่าสุด · แต่ละแท่งซ้อนสีตาม Scope (แดง=1 เหลือง=2 น้ำเงิน=3) · ดูฤดูกาล/เดือนที่ปล่อยสูง' : 'Last 12 months of emissions; each bar is stacked by scope (red=1, amber=2, blue=3). Spot seasonal/high-emission months.'} /></span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyChart} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                  <ReTooltip formatter={(v: number, n: string) => [`${fmt(v)} tCO₂e`, scopeLabel(n)]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="scope1" name="Scope 1" stackId="a" fill={S1} />
                  <Bar dataKey="scope2" name="Scope 2" stackId="a" fill={S2} radius={has3 ? undefined : [4, 4, 0, 0]} />
                  {has3 && <Bar dataKey="scope3" name="Scope 3" stackId="a" fill={S3} radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5 text-purple-500" />{th ? 'รายสถานที่ (ปีนี้)' : 'By Site (this year)'}
              <span className="ml-auto"><InfoTip text={th ? 'การปล่อยรวมรายสถานที่ปีนี้ แยกสีตาม Scope (แท่งซ้อน) · เรียงจากมากไปน้อย — สถานที่บนสุดปล่อยมากสุด ควรให้ความสำคัญก่อน' : 'This year’s emissions per site, stacked by scope, sorted high→low. The top site emits the most — prioritise it.'} /></span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={data.by_site} layout="vertical" margin={{ top: 5, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                  <YAxis type="category" dataKey="site" tick={{ fontSize: 10 }} width={130} />
                  <ReTooltip formatter={(v: number, n: string) => [`${fmt(v)} tCO₂e`, scopeLabel(n)]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="scope1" name="Scope 1" stackId="b" fill={S1} />
                  <Bar dataKey="scope2" name="Scope 2" stackId="b" fill={S2} radius={has3 ? undefined : [0, 4, 4, 0]} />
                  {has3 && <Bar dataKey="scope3" name="Scope 3" stackId="b" fill={S3} radius={[0, 4, 4, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-2 italic">
        {th
          ? '💡 สอดคล้องมาตรฐาน GHG Protocol — Scope 1 = ทางตรง · Scope 2 = พลังงานที่ซื้อ · Scope 3 = ทางอ้อมอื่นในห่วงโซ่คุณค่า'
          : '💡 Aligned with the GHG Protocol — Scope 1 = direct · Scope 2 = purchased energy · Scope 3 = other value-chain indirect'}
      </p>
    </div>
    </TooltipProvider>
  );
}

function KpiCard({ icon: Icon, color, label, value, sub, tip }: { icon: typeof Cloud; color: string; label: string; value: string; sub: string; tip?: string }) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight flex items-center gap-1">
            {label}{tip && <InfoTip text={tip} />}
          </p>
          <div className={`rounded-lg bg-gradient-to-br ${color} p-1.5 shrink-0`}><Icon className="h-3.5 w-3.5 text-white" /></div>
        </div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">{sub}</p>
      </CardContent>
    </Card>
  );
}

function Row({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground truncate">{label}</span>
      <span className="ml-auto font-mono font-semibold text-slate-700">{fmt(value)}</span>
      <span className="text-[10px] text-muted-foreground w-9 text-right">{pct}%</span>
    </div>
  );
}
