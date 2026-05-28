/**
 * ExecutiveDashboard — one-page ESG snapshot for executive / CEO / CFO.
 * Mounted at the top of Dashboard.tsx behind a role === 'executive' guard.
 * All data scoped to the caller's tenant via get_executive_summary() RPC.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RefreshCcw,
  Loader2,
  Leaf,
  Heart,
  Scale,
  FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface HeadlineMetric {
  metric_id: string;
  name: string;
  unit: string | null;
  dim_id: string;
  dim_name: string;
  direction: 'higher_is_better' | 'lower_is_better' | null;
  target: number | null;
  current_ytd: number;
  previous_ytd: number;
  previous_full: number;
  yoy_pct: number | null;
  achievement_pct: number | null;
  on_track: boolean | null;
}
interface DimSummary {
  dimension_id: string;
  name: string;
  metrics: number;
  with_target: number;
  on_track: number;
  off_track: number;
}
interface ExecutiveSummary {
  year: number;
  prev_year: number;
  current_month: number;
  tenant: { name: string; plan: string };
  headline_metrics: HeadlineMetric[];
  dimension_summary: DimSummary[];
  overall: { total: number; on_track: number; off_track: number };
  monthly_trend: Array<{ month: string; records: number }>;
}

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DIM_STYLES: Record<string, { icon: typeof Leaf; color: string; bg: string }> = {
  'Environment':         { icon: Leaf,    color: 'text-emerald-600', bg: 'from-emerald-500 to-teal-600' },
  'Social':              { icon: Heart,   color: 'text-blue-600',    bg: 'from-blue-500 to-cyan-600' },
  'Governance':          { icon: Scale,   color: 'text-purple-600',  bg: 'from-purple-500 to-fuchsia-600' },
  'General Information': { icon: FileText,color: 'text-slate-600',   bg: 'from-slate-500 to-slate-700' },
};

function fmtNum(n: number, decimals = 0): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

// Determine whether YoY change is "good" given direction
function isYoYGood(yoy: number | null, direction: HeadlineMetric['direction']): boolean | null {
  if (yoy == null || direction == null) return null;
  if (direction === 'higher_is_better') return yoy >= 0;
  return yoy <= 0;
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ExecutiveDashboard() {
  const { language } = useLanguage();
  const th = language === 'th';

  const [data, setData] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data: res, error } = await supabase.rpc('get_executive_summary');
      if (error) throw error;
      setData(res as ExecutiveSummary);
    } catch (e) {
      console.error('Executive dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50/40 p-6">
        <div className="flex items-center justify-center py-8 text-blue-600">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          {th ? 'กำลังโหลด Executive Summary...' : 'Loading executive summary...'}
        </div>
      </section>
    );
  }
  if (!data) return null;

  const months = th ? MONTHS_TH : MONTHS_EN;
  const reportingPeriod = `${months[0]}–${months[data.current_month - 1]} ${data.year}`;
  const onTrackPct = data.overall.total > 0
    ? Math.round((data.overall.on_track / data.overall.total) * 100)
    : 0;
  const noTarget = data.overall.total === 0 ? 0 : 0;

  // Donut data
  const donutData = [
    { name: th ? 'บรรลุเป้า' : 'On Track',   value: data.overall.on_track,  color: '#10b981' },
    { name: th ? 'ต่ำกว่าเป้า' : 'Off Track', value: data.overall.off_track, color: '#ef4444' },
  ];

  return (
    <section className="space-y-4">
      {/* ── Header banner ────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 p-5 sm:p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-400 blur-3xl" />
          <div className="absolute -bottom-12 left-1/3 w-32 h-32 rounded-full bg-cyan-400 blur-3xl" />
        </div>
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-2.5 ring-1 ring-white/20">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                {th ? 'สรุปผู้บริหาร' : 'Executive Summary'}
                <Badge variant="outline" className="border-white/30 text-white/90 bg-white/10 text-[10px] uppercase tracking-wider">
                  CEO · CFO View
                </Badge>
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                <Calendar className="h-3 w-3 inline mr-1" />
                {data.tenant.name} · {th ? 'ช่วงรายงาน' : 'Reporting Period'}: {reportingPeriod}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing} className="gap-1.5 bg-white/10 border-white/20 hover:bg-white/20 text-white">
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {th ? 'รีเฟรช' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* ── Top row: Overall donut + Dimension summary ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Overall achievement donut */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-emerald-500" />
              {th ? 'ผลการบรรลุเป้าหมาย ' : 'Target Achievement '}
              ({data.year})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative" style={{ height: 180 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={2}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-bold text-slate-900">{onTrackPct}%</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{th ? 'บรรลุเป้า' : 'On Track'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">{th ? 'บรรลุ' : 'On track'}:</span>
                <span className="font-bold text-emerald-600 ml-auto">{data.overall.on_track}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">{th ? 'ต่ำกว่า' : 'Off track'}:</span>
                <span className="font-bold text-red-500 ml-auto">{data.overall.off_track}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dimension summary — 3 mini cards inside one card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-blue-500" />
              {th ? 'ผลการดำเนินงานรายมิติ' : 'Performance by Dimension'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.dimension_summary.map(d => {
                const style = DIM_STYLES[d.name] ?? DIM_STYLES['General Information'];
                const Icon = style.icon;
                const pct = d.with_target > 0 ? Math.round((d.on_track / d.with_target) * 100) : null;
                return (
                  <div key={d.dimension_id} className="rounded-xl border border-border bg-white p-3 hover:shadow-sm transition">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`rounded-lg bg-gradient-to-br ${style.bg} p-1.5`}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      {pct !== null && (
                        <span className={`text-xs font-bold ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                          {pct}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {d.metrics} {th ? 'ตัวชี้วัด' : 'metrics'} · {d.with_target} {th ? 'มีเป้า' : 'targeted'}
                    </p>
                    {d.with_target > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px]">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                        <span className="text-emerald-600 font-semibold">{d.on_track}</span>
                        <span className="text-muted-foreground">/</span>
                        <AlertCircle className="h-2.5 w-2.5 text-red-500" />
                        <span className="text-red-500 font-semibold">{d.off_track}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Headline metrics grid ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            {th ? 'ตัวชี้วัดหลัก (YTD ' + reportingPeriod + ')' : `Headline Metrics (YTD ${reportingPeriod})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.headline_metrics.map(m => <MetricCard key={m.metric_id} m={m} th={th} />)}
          </div>
        </CardContent>
      </Card>

      {/* ── Monthly entries trend ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-blue-500" />
            {th ? 'การบันทึกข้อมูล (12 เดือนล่าสุด)' : 'Data Entries (Last 12 Months)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={data.monthly_trend} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(s: string) => s?.slice(2)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtNum(v)} />
                <ReTooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(v: number) => [fmtNum(v), th ? 'รายการ' : 'records']}
                />
                <Bar dataKey="records" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ─── Single metric card ──────────────────────────────────────────────────────
function MetricCard({ m, th }: { m: HeadlineMetric; th: boolean }) {
  const style = DIM_STYLES[m.dim_name] ?? DIM_STYLES['General Information'];
  const Icon = style.icon;
  const yoyGood = isYoYGood(m.yoy_pct, m.direction);
  const achievement = m.achievement_pct ?? 0;
  const barColor = m.on_track === true ? '#10b981' : m.on_track === false ? '#ef4444' : '#94a3b8';

  return (
    <div className="rounded-xl border border-border p-3.5 hover:shadow-md transition bg-white">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`rounded-lg bg-gradient-to-br ${style.bg} p-1.5 shrink-0`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.dim_name}</p>
            <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{m.name}</p>
          </div>
        </div>
        {m.on_track !== null && (
          <Badge
            variant="outline"
            className={`text-[9px] shrink-0 ${m.on_track ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600'}`}
          >
            {m.on_track ? (th ? 'บรรลุ' : 'On track') : (th ? 'ต่ำกว่า' : 'Off track')}
          </Badge>
        )}
      </div>

      {/* Big value + YoY */}
      <div className="flex items-end justify-between mb-2 gap-2">
        <div>
          <p className="text-2xl font-bold text-slate-900 leading-none">
            {fmtNum(m.current_ytd, 1)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">{m.unit ?? ''}</p>
        </div>
        {m.yoy_pct != null && (
          <div className={`flex items-center gap-0.5 text-xs font-bold shrink-0 ${
            yoyGood === null ? 'text-muted-foreground' : yoyGood ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {m.yoy_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {m.yoy_pct > 0 ? '+' : ''}{m.yoy_pct.toFixed(1)}%
            <span className="text-[9px] text-muted-foreground font-normal ml-0.5">YoY</span>
          </div>
        )}
      </div>

      {/* Achievement bar */}
      {m.target != null && (
        <div className="space-y-1">
          <div className="relative h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(achievement, 100)}%`, backgroundColor: barColor }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{th ? 'เป้า' : 'Target'}: <span className="font-mono font-semibold text-slate-700">{fmtNum(m.target, 1)}</span></span>
            <span className="font-mono font-semibold" style={{ color: barColor }}>
              {achievement.toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
