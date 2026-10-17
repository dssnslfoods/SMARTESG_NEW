/**
 * ReviewContext — decision support for the Approvals page.
 *
 * Renders the output of the `get_review_context` RPC for one metric_value:
 * previous month (MoM), 3/6-month averages, same month last year, a 12-month
 * bar chart and a deviation assessment. `buildAutoReason()` turns the RPC's
 * structured flags into a TH/EN sentence so a reject can be pre-filled.
 */
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, CheckCircle2, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

// ── Types (mirror the RPC payload) ───────────────────────────────────────────
export type ReviewFlag =
  | { type: 'mom'; pct: number; ref: number; ref_label: string }
  | { type: 'avg3' | 'avg6'; pct: number; ref: number; n: number }
  | { type: 'zscore'; z: number; mean: number; sd: number; n: number }
  | { type: 'zero'; ref: number }
  | { type: 'from_zero'; n: number }
  | { type: 'negative' };

export interface ReviewContextData {
  value_id: string;
  value: number;
  unit: string | null;
  aggregation: string;
  period: { year: number; month: number };
  prev: { value: number; label: string; pct: number | null } | null;
  avg3: { value: number; n: number; pct: number | null } | null;
  avg6: { value: number; n: number; pct: number | null } | null;
  last_year: { value: number; pct: number | null } | null;
  stats: { mean: number; sd: number; n: number; z: number | null } | null;
  history: { period_id: string; year: number; month: number; label: string; value: number; status: string; is_current: boolean }[];
  baseline_n: number;
  level: 'normal' | 'warn' | 'high';
  flags: ReviewFlag[];
}

type Lang = 'th' | 'en';

const fmt = (n: number | null | undefined, digits = 2) =>
  n == null ? '-' : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
const fmtPct = (p: number | null | undefined) =>
  p == null ? '' : `${p > 0 ? '+' : ''}${fmt(p, 1)}%`;

// ── Auto reason (used to pre-fill the reject dialog) ─────────────────────────
export function describeFlag(f: ReviewFlag, lang: Lang, unit?: string | null): string {
  const u = unit ? ` ${unit}` : '';
  switch (f.type) {
    case 'mom':
      return lang === 'th'
        ? `ค่า${f.pct > 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${fmt(Math.abs(f.pct), 1)}% จากเดือนก่อน (${f.ref_label}: ${fmt(f.ref)}${u})`
        : `Value is ${f.pct > 0 ? 'up' : 'down'} ${fmt(Math.abs(f.pct), 1)}% vs previous month (${f.ref_label}: ${fmt(f.ref)}${u})`;
    case 'avg3':
    case 'avg6': {
      const m = f.type === 'avg3' ? 3 : 6;
      return lang === 'th'
        ? `${f.pct > 0 ? 'สูง' : 'ต่ำ'}กว่าค่าเฉลี่ย ${m} เดือนย้อนหลัง ${fmt(Math.abs(f.pct), 1)}% (เฉลี่ย ${fmt(f.ref)}${u} จาก ${f.n} เดือน)`
        : `${fmt(Math.abs(f.pct), 1)}% ${f.pct > 0 ? 'above' : 'below'} the ${m}-month average (${fmt(f.ref)}${u} over ${f.n} months)`;
    }
    case 'zscore':
      return lang === 'th'
        ? `ห่างจากค่าเฉลี่ย 12 เดือน ${fmt(Math.abs(f.z), 1)} เท่าของส่วนเบี่ยงเบนมาตรฐาน (เฉลี่ย ${fmt(f.mean)}${u}, SD ${fmt(f.sd)})`
        : `${fmt(Math.abs(f.z), 1)}σ away from the 12-month mean (${fmt(f.mean)}${u}, SD ${fmt(f.sd)})`;
    case 'zero':
      return lang === 'th'
        ? `ค่าเป็น 0 ทั้งที่ปกติมีค่าประมาณ ${fmt(f.ref)}${u}`
        : `Value is 0 while the usual level is about ${fmt(f.ref)}${u}`;
    case 'from_zero':
      return lang === 'th'
        ? `ย้อนหลัง ${f.n} เดือนมีค่าเป็น 0 มาตลอด แต่เดือนนี้มีค่าเข้ามา — กรุณายืนยันว่าเกิดเหตุการณ์จริง`
        : `The last ${f.n} months were all 0 but this month has a value — please confirm it actually occurred`;
    case 'negative':
      return lang === 'th' ? 'ค่าติดลบ ซึ่งไม่น่าเป็นไปได้สำหรับตัวชี้วัดนี้' : 'Value is negative, which is not plausible for this metric';
  }
}

export function buildAutoReason(ctx: ReviewContextData | undefined, lang: Lang): string {
  if (!ctx || ctx.level === 'normal' || ctx.flags.length === 0) return '';
  const lines = ctx.flags.map(f => '• ' + describeFlag(f, lang, ctx.unit));
  const head = lang === 'th'
    ? `ค่าที่กรอก (${fmt(ctx.value)}${ctx.unit ? ' ' + ctx.unit : ''}) ผิดจากค่าปกติอย่างมีนัยสำคัญ กรุณาตรวจสอบหน่วย/ตัวเลข/แหล่งข้อมูล แล้วส่งใหม่:`
    : `The submitted value (${fmt(ctx.value)}${ctx.unit ? ' ' + ctx.unit : ''}) deviates significantly from the normal level. Please verify the unit / figure / source and resubmit:`;
  return [head, ...lines].join('\n');
}

// ── Small visual pieces ──────────────────────────────────────────────────────
export function LevelBadge({ level, lang, compact }: { level: ReviewContextData['level']; lang: Lang; compact?: boolean }) {
  if (level === 'normal') {
    return compact ? null : (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 rounded-full gap-1">
        <CheckCircle2 className="h-3 w-3" /> {lang === 'th' ? 'อยู่ในช่วงปกติ' : 'Within normal range'}
      </Badge>
    );
  }
  const high = level === 'high';
  return (
    <Badge variant="outline" className={cn('rounded-full gap-1', high ? 'bg-red-50 text-red-700 border-red-300' : 'bg-amber-50 text-amber-700 border-amber-300')}>
      <AlertTriangle className="h-3 w-3" />
      {high ? (lang === 'th' ? 'ผิดปกติมาก' : 'Significant deviation') : (lang === 'th' ? 'ควรตรวจสอบ' : 'Check')}
    </Badge>
  );
}

function DeltaChip({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">—</span>;
  const big = Math.abs(pct) >= 50;
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold rounded-md px-1.5 py-0.5',
      big ? 'bg-red-100 text-red-700' : Math.abs(pct) >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600')}>
      <Icon className="h-3 w-3" /> {fmtPct(pct)}
    </span>
  );
}

function StatCard({ title, value, unit, pct, sub, highlight }: {
  title: string; value: number | null | undefined; unit?: string | null; pct?: number | null; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border px-3 py-2.5 bg-white/80', highlight ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-gray-200')}>
      <div className="text-[11px] text-muted-foreground">{title}</div>
      <div className="flex items-baseline justify-between gap-2 mt-0.5">
        <div className={cn('font-mono font-bold', highlight ? 'text-xl text-emerald-700' : 'text-lg text-gray-800')}>
          {value == null ? '-' : fmt(value)}
          {value != null && unit && <span className="text-[10px] font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
        {pct !== undefined && <DeltaChip pct={pct} />}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function ReviewContextView({ ctx, lang }: { ctx: ReviewContextData; lang: Lang }) {
  const th = lang === 'th';
  const chartData = useMemo(() => ctx.history.map(h => ({
    label: h.label.replace(/^(\w{3})\w*/, '$1'), // "October 2026" → "Oct 2026"
    value: Number(h.value),
    current: h.is_current,
  })), [ctx.history]);

  const mean = ctx.stats?.mean ?? null;

  return (
    <div className="space-y-4">
      {/* Assessment banner */}
      <div className={cn('rounded-xl border px-4 py-3',
        ctx.level === 'high' ? 'border-red-300 bg-red-50/80' :
        ctx.level === 'warn' ? 'border-amber-300 bg-amber-50/80' : 'border-emerald-200 bg-emerald-50/60')}>
        <div className="flex items-center gap-2 flex-wrap">
          <LevelBadge level={ctx.level} lang={lang} />
          <span className="text-xs text-muted-foreground">
            {ctx.baseline_n === 0
              ? (th ? 'ยังไม่มีข้อมูลที่อนุมัติแล้วให้เปรียบเทียบ' : 'No approved history to compare against')
              : (th ? `เทียบกับข้อมูลที่อนุมัติแล้ว ${ctx.baseline_n} เดือนย้อนหลัง` : `Compared with ${ctx.baseline_n} approved months`)}
          </span>
        </div>
        {ctx.flags.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {ctx.flags.map((f, i) => (
              <li key={i} className={cn('flex gap-2', ctx.level === 'high' ? 'text-red-800' : 'text-amber-800')}>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{describeFlag(f, lang, ctx.unit)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Comparison cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <StatCard highlight title={th ? 'ค่าที่ส่งมา' : 'Submitted'} value={ctx.value} unit={ctx.unit} />
        <StatCard title={th ? 'เดือนก่อน (MoM)' : 'Previous month (MoM)'} value={ctx.prev?.value} unit={ctx.unit}
          pct={ctx.prev?.pct ?? null} sub={ctx.prev?.label} />
        <StatCard title={th ? 'เฉลี่ย 3 เดือน' : '3-month avg'} value={ctx.avg3?.value} unit={ctx.unit}
          pct={ctx.avg3?.pct ?? null} sub={ctx.avg3 ? (th ? `${ctx.avg3.n} เดือน` : `${ctx.avg3.n} months`) : undefined} />
        <StatCard title={th ? 'เฉลี่ย 6 เดือน' : '6-month avg'} value={ctx.avg6?.value} unit={ctx.unit}
          pct={ctx.avg6?.pct ?? null} sub={ctx.avg6 ? (th ? `${ctx.avg6.n} เดือน` : `${ctx.avg6.n} months`) : undefined} />
        <StatCard title={th ? 'เดือนเดียวกันปีก่อน (YoY)' : 'Same month last year (YoY)'} value={ctx.last_year?.value} unit={ctx.unit}
          pct={ctx.last_year?.pct ?? null} />
      </div>

      {/* 12-month chart */}
      <div className="rounded-xl border border-gray-200 bg-white/80 p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-gray-700">
            {th ? 'ประวัติ 12 เดือน (เฉพาะที่อนุมัติแล้ว)' : '12-month history (approved only)'}
          </div>
          {ctx.stats && (
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Info className="h-3 w-3" />
              {th ? 'เฉลี่ย' : 'mean'} {fmt(ctx.stats.mean)} · SD {fmt(ctx.stats.sd)}
              {ctx.stats.z != null && <> · z = {fmt(ctx.stats.z, 2)}</>}
            </div>
          )}
        </div>
        {chartData.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">{th ? 'ไม่มีข้อมูล' : 'No data'}</div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 10 }} width={48} />
                <Tooltip formatter={(v: number) => [fmt(v), ctx.unit ?? '']} />
                {mean != null && <ReferenceLine y={mean} stroke="#64748b" strokeDasharray="4 4" />}
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.current ? (ctx.level === 'high' ? '#dc2626' : ctx.level === 'warn' ? '#d97706' : '#059669') : '#a7f3d0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
