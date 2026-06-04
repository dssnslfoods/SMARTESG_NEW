import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Cloud, Factory, Zap, TrendingDown, TrendingUp, Target, RefreshCcw, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line,
} from 'recharts';

interface GhgSummary {
  year: number; prev_year: number; current_month: number; unit: string; tenant: string;
  ytd: { scope1: number; scope2: number; total: number };
  prev_ytd: { total: number };
  monthly: Array<{ month: string; scope1: number; scope2: number }>;
  by_site: Array<{ site: string; scope1: number; scope2: number; total: number }>;
  yearly: Array<{ year: number; scope1: number; scope2: number; total: number }>;
  target: { scope1: number | null; scope2: number | null };
}

const S1 = '#ef4444'; // scope 1 red
const S2 = '#f59e0b'; // scope 2 amber

function fmt(n: number): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
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

  const months = th
    ? ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const reportingPeriod = `${months[0]}–${months[data.current_month - 1]} ${data.year}`;

  const totalTarget = (data.target.scope1 ?? 0) + (data.target.scope2 ?? 0);
  const yoy = data.prev_ytd.total > 0
    ? ((data.ytd.total - data.prev_ytd.total) / data.prev_ytd.total) * 100
    : null;
  const yoyGood = yoy != null && yoy <= 0; // lower emissions is better

  const donut = [
    { name: th ? 'Scope 1 (ทางตรง)' : 'Scope 1 (direct)', value: data.ytd.scope1, color: S1 },
    { name: th ? 'Scope 2 (ไฟฟ้า)' : 'Scope 2 (electricity)', value: data.ytd.scope2, color: S2 },
  ];
  const monthlyChart = data.monthly.map(m => ({ ...m, label: m.month.slice(2) }));
  // yearly with a target marker on the current year
  const yearlyChart = data.yearly.map(y => ({
    year: String(y.year),
    total: y.total,
    target: y.year === data.year && totalTarget > 0 ? totalTarget : null,
  }));

  return (
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Cloud}   color="from-slate-700 to-slate-900"  label={th ? 'รวม Scope 1+2 (YTD)' : 'Total Scope 1+2 (YTD)'}
                 value={fmt(data.ytd.total)} sub="tCO₂e" />
        <KpiCard icon={Factory} color="from-red-500 to-rose-600"     label={th ? 'Scope 1 — ทางตรง' : 'Scope 1 — Direct'}
                 value={fmt(data.ytd.scope1)} sub="tCO₂e" />
        <KpiCard icon={Zap}     color="from-amber-500 to-orange-600" label={th ? 'Scope 2 — ไฟฟ้า' : 'Scope 2 — Electricity'}
                 value={fmt(data.ytd.scope2)} sub="tCO₂e" />
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardContent className="p-3.5">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{th ? 'เทียบปีก่อน (YoY)' : 'Year-over-Year'}</p>
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
          <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-emerald-500" />{th ? 'สัดส่วนตาม Scope (YTD)' : 'Breakdown by Scope (YTD)'}</CardTitle></CardHeader>
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
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-emerald-500" />{th ? 'เส้นทางสู่ Net Zero (รายปี)' : 'Net-Zero Trajectory (yearly)'}</CardTitle></CardHeader>
          <CardContent className="pt-2 pb-4">
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <ComposedChart data={yearlyChart} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                  <ReTooltip formatter={(v: number, n: string) => [`${fmt(v)} tCO₂e`, n === 'target' ? (th ? 'เป้าหมาย' : 'Target') : (th ? 'ปล่อยจริง' : 'Actual')]} />
                  <Bar dataKey="total" name={th ? 'ปล่อยจริง' : 'Actual'} fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={56} />
                  <Line dataKey="target" name={th ? 'เป้าหมาย' : 'Target'} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              {th ? '🎯 เส้นประ = เป้าหมายปีปัจจุบัน · แท่ง = การปล่อยจริงรายปี' : '🎯 Dashed = current-year target · bars = actual yearly emissions'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly stacked + by site */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5 text-blue-500" />{th ? 'รายเดือน (12 เดือน) — Scope 1+2' : 'Monthly (12 mo) — Scope 1+2'}</CardTitle></CardHeader>
          <CardContent className="pt-2 pb-4">
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyChart} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                  <ReTooltip formatter={(v: number, n: string) => [`${fmt(v)} tCO₂e`, n === 'scope1' ? 'Scope 1' : 'Scope 2']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="scope1" name="Scope 1" stackId="a" fill={S1} />
                  <Bar dataKey="scope2" name="Scope 2" stackId="a" fill={S2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><Factory className="h-3.5 w-3.5 text-purple-500" />{th ? 'รายสถานที่ (ปีนี้)' : 'By Site (this year)'}</CardTitle></CardHeader>
          <CardContent className="pt-2 pb-4">
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={data.by_site} layout="vertical" margin={{ top: 5, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                  <YAxis type="category" dataKey="site" tick={{ fontSize: 10 }} width={130} />
                  <ReTooltip formatter={(v: number, n: string) => [`${fmt(v)} tCO₂e`, n === 'scope1' ? 'Scope 1' : 'Scope 2']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="scope1" name="Scope 1" stackId="b" fill={S1} />
                  <Bar dataKey="scope2" name="Scope 2" stackId="b" fill={S2} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-2 italic">
        {th ? '💡 สอดคล้องมาตรฐาน GHG Protocol (Scope 1 = ทางตรง, Scope 2 = พลังงานซื้อ)' : '💡 Aligned with the GHG Protocol (Scope 1 = direct, Scope 2 = purchased energy)'}
      </p>
    </div>
  );
}

function KpiCard({ icon: Icon, color, label, value, sub }: { icon: typeof Cloud; color: string; label: string; value: string; sub: string }) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">{label}</p>
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
