import { useEffect, useState, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Leaf,
  Heart,
  Scale,
  Network,
  FileText,
  Layers3,
  Hash,
  Sparkles,
  ChevronRight,
  X as XIcon,
  Filter as FilterIcon,
  Target,
  FileInput,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Activity,
  Database,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Download,
  Maximize2,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Metric {
  metric_id: string;
  metric_name: string;
  unit: string | null;
}
interface Theme {
  theme_id: string;
  theme_name: string;
  metrics: Metric[];
}
interface Dimension {
  dimension_id: string;
  dimension_name: string;
  themes: Theme[];
}
interface MetricValueRow {
  value: number;
  status: string;
  period: { year: number; month: number } | null;
  site: { site_id: string; site_name: string } | null;
}
interface TargetRow {
  year: number;
  target_value: number;
  target_direction: 'lower_is_better' | 'higher_is_better';
  note: string | null;
}

// ─── Visual styles per dimension ──────────────────────────────────────────────
interface DimStyle {
  icon: typeof Leaf;
  bannerGradient: string;
  bannerBgPattern: string;
  themeHeaderBg: string;
  themeHeaderText: string;
  themeBorder: string;
  metricBg: string;
  metricHover: string;
  accentDot: string;
  heroAccent: string;
  chartColor: string;
  chartColorLight: string;
}

const STYLES: Record<string, DimStyle> = {
  Environment: {
    icon: Leaf,
    bannerGradient: 'from-emerald-500 via-emerald-600 to-teal-700',
    bannerBgPattern: 'bg-emerald-50/40',
    themeHeaderBg: 'bg-gradient-to-b from-emerald-100 to-emerald-50',
    themeHeaderText: 'text-emerald-900',
    themeBorder: 'border-emerald-300',
    metricBg: 'bg-white border-emerald-100',
    metricHover: 'hover:bg-emerald-50 hover:border-emerald-300',
    accentDot: 'bg-emerald-500',
    heroAccent: 'text-emerald-600',
    chartColor: '#10b981',
    chartColorLight: '#a7f3d0',
  },
  Social: {
    icon: Heart,
    bannerGradient: 'from-blue-500 via-cyan-600 to-blue-700',
    bannerBgPattern: 'bg-blue-50/40',
    themeHeaderBg: 'bg-gradient-to-b from-blue-100 to-blue-50',
    themeHeaderText: 'text-blue-900',
    themeBorder: 'border-blue-300',
    metricBg: 'bg-white border-blue-100',
    metricHover: 'hover:bg-blue-50 hover:border-blue-300',
    accentDot: 'bg-blue-500',
    heroAccent: 'text-blue-600',
    chartColor: '#3b82f6',
    chartColorLight: '#bfdbfe',
  },
  Governance: {
    icon: Scale,
    bannerGradient: 'from-amber-500 via-orange-600 to-amber-700',
    bannerBgPattern: 'bg-amber-50/40',
    themeHeaderBg: 'bg-gradient-to-b from-amber-100 to-amber-50',
    themeHeaderText: 'text-amber-900',
    themeBorder: 'border-amber-300',
    metricBg: 'bg-white border-amber-100',
    metricHover: 'hover:bg-amber-50 hover:border-amber-300',
    accentDot: 'bg-amber-500',
    heroAccent: 'text-amber-600',
    chartColor: '#f59e0b',
    chartColorLight: '#fde68a',
  },
  'General Information': {
    icon: FileText,
    bannerGradient: 'from-slate-500 via-slate-600 to-slate-700',
    bannerBgPattern: 'bg-slate-50/40',
    themeHeaderBg: 'bg-gradient-to-b from-slate-100 to-slate-50',
    themeHeaderText: 'text-slate-800',
    themeBorder: 'border-slate-300',
    metricBg: 'bg-white border-slate-200',
    metricHover: 'hover:bg-slate-50 hover:border-slate-400',
    accentDot: 'bg-slate-500',
    heroAccent: 'text-slate-600',
    chartColor: '#64748b',
    chartColorLight: '#cbd5e1',
  },
};

const FALLBACK_STYLE = STYLES['General Information'];
const DIM_ORDER = ['Environment', 'Social', 'Governance', 'General Information'];
const cleanThemeName = (s: string) => s.replace(/^\d+\.\s*/, '').trim();
const getStyle = (name: string) => STYLES[name] ?? FALLBACK_STYLE;

// ─── Format helpers ───────────────────────────────────────────────────────────
const MONTH_NAMES = {
  th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const periodLabel = (y: number, m: number, th: boolean) =>
  `${MONTH_NAMES[th ? 'th' : 'en'][m - 1] ?? '?'} ${String(y).slice(-2)}`;

const formatNumber = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

const formatCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
};

// ─── Chip ─────────────────────────────────────────────────────────────────────
interface ChipItem {
  id: string | null;
  label: string;
}
type ChipColor = 'emerald' | 'blue' | 'amber';

function FilterChip({
  item,
  selected,
  onClick,
  color,
}: {
  item: ChipItem;
  selected: boolean;
  onClick: () => void;
  color: ChipColor;
}) {
  const colorMap: Record<ChipColor, string> = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700 ring-emerald-200',
    blue: 'bg-blue-600 hover:bg-blue-700 ring-blue-200',
    amber: 'bg-amber-600 hover:bg-amber-700 ring-amber-200',
  };
  const isAllChip = item.id === null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap ${
        selected
          ? isAllChip
            ? 'bg-slate-200 text-slate-700 ring-2 ring-slate-300/60 shadow-sm'
            : `${colorMap[color]} text-white ring-2 shadow-md`
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
      }`}
    >
      {item.label}
    </button>
  );
}

function FilterRow({
  icon: Icon,
  label,
  items,
  selected,
  onChange,
  color,
  iconColor,
}: {
  icon: typeof Layers3;
  label: string;
  items: ChipItem[];
  selected: string | null;
  onChange: (id: string | null) => void;
  color: ChipColor;
  iconColor: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center gap-1.5 shrink-0 min-w-24 pt-1">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="text-xs font-bold text-foreground">{label}</span>
      </div>
      <div className="flex-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <FilterChip
            key={item.id ?? '_all'}
            item={item}
            selected={selected === item.id}
            onClick={() => onChange(item.id)}
            color={color}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Theme column ─────────────────────────────────────────────────────────────
function ThemeColumn({
  theme,
  style,
  th,
  onThemeClick,
  onMetricClick,
}: {
  theme: Theme;
  style: DimStyle;
  th: boolean;
  onThemeClick?: () => void;
  onMetricClick?: (metricId: string) => void;
}) {
  const headerInner = (
    <>
      <h3 className={`text-sm font-bold ${style.themeHeaderText} leading-tight`}>
        {cleanThemeName(theme.theme_name)}
      </h3>
      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
        <Hash className="h-2.5 w-2.5" />
        {theme.metrics.length} {th ? 'ตัวชี้วัด' : 'metrics'}
      </p>
    </>
  );

  return (
    <div
      className={`rounded-2xl border-2 ${style.themeBorder} overflow-hidden bg-white/95 shadow-sm hover:shadow-md transition-shadow`}
    >
      {onThemeClick ? (
        <button
          type="button"
          onClick={onThemeClick}
          title={th ? 'ดูเฉพาะ Theme นี้' : 'Drill into this theme'}
          className={`w-full ${style.themeHeaderBg} px-3 py-2.5 border-b ${style.themeBorder} text-center cursor-pointer hover:brightness-95 active:brightness-90 transition`}
        >
          {headerInner}
        </button>
      ) : (
        <div className={`${style.themeHeaderBg} px-3 py-2.5 border-b ${style.themeBorder} text-center`}>
          {headerInner}
        </div>
      )}

      <div className="p-2 space-y-1.5">
        {theme.metrics.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 text-center py-3 italic">
            {th ? '(ยังไม่มีตัวชี้วัด)' : '(no metrics)'}
          </p>
        ) : (
          theme.metrics.map((m) => {
            const innerContent = (
              <div className="flex items-start gap-2">
                <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${style.accentDot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 leading-snug">{m.metric_name}</p>
                  {m.unit && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{m.unit}</p>
                  )}
                </div>
                {onMetricClick && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0" />
                )}
              </div>
            );

            return onMetricClick ? (
              <button
                key={m.metric_id}
                type="button"
                onClick={() => onMetricClick(m.metric_id)}
                title={th ? 'ดู Infographic ของตัวชี้วัดนี้' : 'View metric infographic'}
                className={`w-full text-left rounded-lg border ${style.metricBg} ${style.metricHover} px-2.5 py-2 transition-all cursor-pointer hover:shadow-md group`}
              >
                {innerContent}
              </button>
            ) : (
              <div
                key={m.metric_id}
                className={`rounded-lg border ${style.metricBg} px-2.5 py-2 transition-all cursor-default`}
              >
                {innerContent}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Dimension card ───────────────────────────────────────────────────────────
function DimensionCard({
  dim,
  themesOverride,
  th,
  onSelect,
}: {
  dim: Dimension;
  themesOverride?: Theme[];
  th: boolean;
  onSelect?: (dimId: string, themeId: string, metricId?: string) => void;
}) {
  const style = getStyle(dim.dimension_name);
  const Icon = style.icon;
  const themes = themesOverride ?? dim.themes;
  const metricCount = themes.reduce((s, t) => s + t.metrics.length, 0);

  return (
    <Card className="glass-card-solid overflow-hidden border-0 shadow-xl">
      <div className={`relative bg-gradient-to-r ${style.bannerGradient} px-5 sm:px-7 py-4 sm:py-5 text-white overflow-hidden`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white blur-3xl" />
          <div className="absolute -bottom-12 left-1/3 w-32 h-32 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="rounded-2xl bg-white/25 backdrop-blur-sm p-3 ring-1 ring-white/30">
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{dim.dimension_name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs sm:text-sm opacity-95">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                {themes.length} {th ? 'หัวข้อหลัก' : 'themes'}
              </span>
              <span className="opacity-50">·</span>
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {metricCount} {th ? 'ตัวชี้วัด' : 'metrics'}
              </span>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="bg-white/25 text-white border-0 backdrop-blur-sm uppercase tracking-wider text-[10px] hidden sm:inline-flex"
          >
            {th ? 'เสาหลัก ESG' : 'ESG Pillar'}
          </Badge>
        </div>
      </div>
      <CardContent className={`p-3 sm:p-4 ${style.bannerBgPattern}`}>
        {themes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {th ? '(ไม่มี theme)' : '(no themes)'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {themes.map((t) => (
              <ThemeColumn
                key={t.theme_id}
                theme={t}
                style={style}
                th={th}
                onThemeClick={onSelect ? () => onSelect(dim.dimension_id, t.theme_id) : undefined}
                onMetricClick={
                  onSelect ? (mid) => onSelect(dim.dimension_id, t.theme_id, mid) : undefined
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white/90 border border-white p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </p>
        <Icon className={`h-4 w-4 opacity-60 ${color}`} />
      </div>
      <p className={`text-xl font-bold ${color} leading-tight`}>{value}</p>
      {sublabel && (
        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{sublabel}</p>
      )}
    </div>
  );
}

// ─── Section header for charts ────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  sublabel,
  color,
}: {
  icon: typeof Hash;
  title: string;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {sublabel && <span className="text-xs text-muted-foreground">· {sublabel}</span>}
    </div>
  );
}

// ─── Custom recharts tooltip ──────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  unit?: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-white/95 backdrop-blur-sm shadow-xl px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className="text-muted-foreground">
        <span className="font-mono font-bold text-foreground">
          {formatNumber(Number(payload[0].value))}
        </span>{' '}
        {unit ?? ''}
      </p>
    </div>
  );
}

// ─── Metric Hero (drill-down infographic) ─────────────────────────────────────
function MetricHero({
  dim,
  theme,
  metric,
  th,
}: {
  dim: Dimension;
  theme: Theme;
  metric: Metric;
  th: boolean;
}) {
  const style = getStyle(dim.dimension_name);
  const Icon = style.icon;

  const [values, setValues] = useState<MetricValueRow[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [valuesRes, targetsRes] = await Promise.all([
          supabase
            .from('metric_value')
            .select(`
              value, status,
              period:period_id(year, month),
              site:site_id(site_id, site_name)
            `)
            .eq('metric_id', metric.metric_id)
            .in('status', ['approved', 'submitted']),
          // Fetch ALL targets for this metric — not just current year — so we
          // can compare each year's actual against its own target.
          supabase
            .from('metric_target')
            .select('year, target_value, target_direction, note')
            .eq('metric_id', metric.metric_id),
        ]);
        if (cancelled) return;
        setValues((valuesRes.data ?? []) as any);
        setTargets((targetsRes.data ?? []) as any);
      } catch (e) {
        console.error('MetricHero load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [metric.metric_id]);

  // Current year target — drives the Target Achievement card
  const currentTarget = useMemo(
    () => targets.find((t) => t.year === currentYear) ?? null,
    [targets, currentYear],
  );

  // Lookup by year — drives per-year bar coloring in the yearly chart
  const targetByYear = useMemo(() => {
    const m = new Map<number, TargetRow>();
    targets.forEach((t) => m.set(t.year, t));
    return m;
  }, [targets]);

  // ── Aggregations ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (values.length === 0) return null;
    const nums = values.map((v) => Number(v.value));
    const total = nums.reduce((s, n) => s + n, 0);
    const avg = total / nums.length;
    const sorted = [...values].sort((a, b) => {
      const ka = `${a.period?.year ?? 0}-${String(a.period?.month ?? 0).padStart(2, '0')}`;
      const kb = `${b.period?.year ?? 0}-${String(b.period?.month ?? 0).padStart(2, '0')}`;
      return ka.localeCompare(kb);
    });
    const latest = Number(sorted[sorted.length - 1]?.value ?? 0);
    const uniqueSites = new Set(values.map((v) => v.site?.site_id).filter(Boolean));
    // Current-year only sum — used for per-year target achievement
    const currentYearTotal = values
      .filter((v) => v.period?.year === currentYear)
      .reduce((s, v) => s + Number(v.value), 0);
    return {
      total,
      avg,
      latest,
      count: values.length,
      siteCount: uniqueSites.size,
      currentYearTotal,
    };
  }, [values, currentYear]);

  const timeSeries = useMemo(() => {
    const map = new Map<string, { key: string; label: string; year: number; month: number; total: number }>();
    values.forEach((v) => {
      const y = v.period?.year ?? 0;
      const m = v.period?.month ?? 0;
      if (!y || !m) return;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const existing = map.get(key);
      if (existing) existing.total += Number(v.value);
      else
        map.set(key, {
          key,
          label: periodLabel(y, m, th),
          year: y,
          month: m,
          total: Number(v.value),
        });
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [values, th]);

  const bySite = useMemo(() => {
    const map = new Map<string, { site_id: string; site_name: string; total: number; count: number }>();
    values.forEach((v) => {
      const id = v.site?.site_id;
      if (!id) return;
      const existing = map.get(id);
      if (existing) {
        existing.total += Number(v.value);
        existing.count += 1;
      } else {
        map.set(id, {
          site_id: id,
          site_name: v.site?.site_name ?? id,
          total: Number(v.value),
          count: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [values]);

  // Achievement = current-year actual ÷ current-year target.
  // Cumulative would be misleading because the target is per-year.
  const achievement = useMemo(() => {
    if (!currentTarget || !stats) return null;
    const tv = Number(currentTarget.target_value);
    const actual = stats.currentYearTotal;
    const pct = tv === 0 ? 0 : (actual / tv) * 100;
    const isLower = currentTarget.target_direction === 'lower_is_better';
    const onTrack = isLower ? actual <= tv : actual >= tv;
    return { pct, onTrack, isLower, actual };
  }, [currentTarget, stats]);

  // Aggregated values per year — last 3 years (or fewer if not available).
  // Each year is compared to its OWN target (not the current year's target),
  // because a 2024 bar should reflect whether 2024 hit its 2024 goal.
  const yearlyData = useMemo(() => {
    const yearMap = new Map<number, number>();
    values.forEach((v) => {
      const year = v.period?.year;
      if (!year) return;
      yearMap.set(year, (yearMap.get(year) ?? 0) + Number(v.value));
    });
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    const recentYears = sortedYears.length > 3 ? sortedYears.slice(-3) : sortedYears;
    return recentYears.map((year) => {
      const actual = yearMap.get(year) ?? 0;
      const t = targetByYear.get(year);
      let status: 'on-track' | 'off-track' | 'no-target' = 'no-target';
      if (t) {
        const tv = Number(t.target_value);
        const isLower = t.target_direction === 'lower_is_better';
        status = (isLower ? actual <= tv : actual >= tv) ? 'on-track' : 'off-track';
      }
      return {
        year: String(year),
        actual,
        status,
        yearTarget: t ? Number(t.target_value) : null,
      };
    });
  }, [values, targetByYear]);

  const hasData = values.length > 0;
  const unit = metric.unit ?? '';

  return (
    <Card className="glass-card-solid overflow-hidden border-0 shadow-2xl">
      {/* Breadcrumb banner */}
      <div className={`relative bg-gradient-to-r ${style.bannerGradient} px-6 py-3 text-white overflow-hidden`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative flex items-center gap-2 text-xs sm:text-sm opacity-95 flex-wrap">
          <Icon className="h-4 w-4" />
          <span className="font-semibold">{dim.dimension_name}</span>
          <ChevronRight className="h-3.5 w-3.5 opacity-70" />
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-semibold">{cleanThemeName(theme.theme_name)}</span>
          <ChevronRight className="h-3.5 w-3.5 opacity-70" />
          <Hash className="h-3.5 w-3.5" />
          <span className="font-semibold opacity-90">{th ? 'ตัวชี้วัด' : 'Metric'}</span>
        </div>
      </div>

      <CardContent className={`${style.bannerBgPattern} p-0`}>
        {/* Hero title */}
        <div className="py-7 px-6 text-center border-b border-border/30 bg-white/40">
          <div className={`inline-flex items-center justify-center h-14 w-14 rounded-full bg-white mb-3 ring-4 ring-${dim.dimension_name === 'Environment' ? 'emerald' : dim.dimension_name === 'Social' ? 'blue' : dim.dimension_name === 'Governance' ? 'amber' : 'slate'}-100`}>
            <Hash className={`h-7 w-7 ${style.heroAccent}`} />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2 font-mono">
            {metric.metric_id}
          </p>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground max-w-3xl mx-auto leading-tight">
            {metric.metric_name}
          </h2>
          {metric.unit && (
            <div className="mt-3 flex justify-center">
              <Badge variant="outline" className="text-sm font-mono px-3 py-1 bg-white/70 backdrop-blur-sm">
                {th ? 'หน่วย: ' : 'Unit: '}
                <span className={`ml-1 font-bold ${style.heroAccent}`}>{metric.unit}</span>
              </Badge>
            </div>
          )}
          <div className="mt-5 flex justify-center">
            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Link to={`/master/targets?metric=${encodeURIComponent(metric.metric_id)}`}>
                <Target className="h-3.5 w-3.5" />
                {th ? 'กำหนดเป้าหมายให้ตัวชี้วัดนี้' : 'Set Target for This Metric'}
              </Link>
            </Button>
          </div>
        </div>

        {/* Infographic body */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : !hasData ? (
          <div className="px-6 py-12 text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">
              {th ? 'ยังไม่มีข้อมูลของตัวชี้วัดนี้' : 'No data yet for this metric'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {th
                ? 'ไปที่ Data Entry เพื่อเริ่มบันทึกข้อมูล'
                : 'Head to Data Entry to start recording values'}
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatCard
                icon={Database}
                label={th ? 'ยอดรวมสะสม' : 'Total'}
                value={formatCompact(stats!.total)}
                sublabel={unit}
                color={style.heroAccent}
              />
              <StatCard
                icon={Activity}
                label={th ? 'ค่าล่าสุด' : 'Latest'}
                value={formatCompact(stats!.latest)}
                sublabel={unit}
                color={style.heroAccent}
              />
              <StatCard
                icon={Calendar}
                label={th ? 'บันทึก' : 'Records'}
                value={String(stats!.count)}
                sublabel={th ? 'รายการ' : 'entries'}
                color={style.heroAccent}
              />
              <StatCard
                icon={Building2}
                label={th ? 'สาขา' : 'Sites'}
                value={String(stats!.siteCount)}
                sublabel={th ? 'สาขา' : 'locations'}
                color={style.heroAccent}
              />
            </div>

            {/* Time series chart */}
            {timeSeries.length > 0 && (
              <div className="rounded-2xl bg-white/90 border border-white p-4 shadow-sm">
                <SectionHeader
                  icon={TrendingUp}
                  title={th ? 'แนวโน้มตามช่วงเวลา' : 'Trend by Period'}
                  sublabel={`${timeSeries.length} ${th ? 'ช่วง' : 'periods'}`}
                  color={style.heroAccent}
                />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={timeSeries} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={formatCompact}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReTooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="total" fill={style.chartColor} radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Per-site chart */}
            {bySite.length > 1 && (
              <div className="rounded-2xl bg-white/90 border border-white p-4 shadow-sm">
                <SectionHeader
                  icon={Building2}
                  title={th ? 'เปรียบเทียบรายสาขา' : 'Per-Site Comparison'}
                  sublabel={`${bySite.length} ${th ? 'สาขา' : 'sites'}`}
                  color={style.heroAccent}
                />
                <ResponsiveContainer width="100%" height={Math.max(200, bySite.length * 38)}>
                  <BarChart
                    data={bySite}
                    layout="vertical"
                    margin={{ top: 5, right: 30, bottom: 5, left: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={formatCompact}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="site_name"
                      tick={{ fontSize: 10, fill: '#475569' }}
                      width={140}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReTooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      {bySite.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? style.chartColor : style.chartColorLight}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Target achievement */}
            {currentTarget && achievement && (
              <div
                className={`rounded-2xl border-2 p-4 ${
                  achievement.onTrack
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Target className={`h-4 w-4 ${achievement.onTrack ? 'text-emerald-600' : 'text-rose-600'}`} />
                    <h3 className="text-sm font-bold text-foreground">
                      {th ? 'ความคืบหน้าตามเป้าหมาย' : 'Target Achievement'}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[10px] gap-1 ${
                        currentTarget.target_direction === 'higher_is_better'
                          ? 'border-emerald-300 text-emerald-700 bg-white/50'
                          : 'border-blue-300 text-blue-700 bg-white/50'
                      }`}
                    >
                      {currentTarget.target_direction === 'higher_is_better' ? (
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
                  </div>
                  <Badge
                    className={`text-sm font-bold px-3 py-1 ${
                      achievement.onTrack
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {achievement.onTrack ? (
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    )}
                    {achievement.pct.toFixed(1)}%
                  </Badge>
                </div>

                {/* Actual vs Target values (per-year, not cumulative) */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {th ? `ค่าจริงปี ${currentYear}` : `Actual ${currentYear}`}
                    </p>
                    <p className={`text-lg font-bold mt-0.5 ${style.heroAccent}`}>
                      {formatCompact(stats!.currentYearTotal)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {th ? `เป้าหมายปี ${currentYear}` : `Target ${currentYear}`}
                    </p>
                    <p className="text-lg font-bold mt-0.5 text-foreground">
                      {formatCompact(Number(currentTarget.target_value))}{' '}
                      <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                    </p>
                  </div>
                </div>

                {/* Yearly comparison chart — last 3 years vs target */}
                {yearlyData.length > 0 && (
                  <div className="rounded-xl bg-white/70 px-3 pt-3 pb-2 mb-3 border border-border/40">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3" />
                        {th ? 'เปรียบเทียบรายปี vs เป้าหมาย' : 'Yearly Performance vs Target'}
                      </p>
                      <span className="text-[10px] text-muted-foreground/70">
                        {yearlyData.length}{' '}
                        {th
                          ? `ปีล่าสุด${yearlyData.length >= 3 ? ' (3 ปี)' : ''}`
                          : `year${yearlyData.length > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        data={yearlyData}
                        margin={{ top: 18, right: 70, bottom: 0, left: -10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="year"
                          tick={{ fontSize: 12, fill: '#475569', fontWeight: 700 }}
                          axisLine={{ stroke: '#e5e7eb' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickFormatter={formatCompact}
                          axisLine={false}
                          tickLine={false}
                        />
                        <ReTooltip
                          content={<ChartTooltip unit={unit} />}
                          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        />
                        <ReferenceLine
                          y={Number(currentTarget.target_value)}
                          stroke="#f59e0b"
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          ifOverflow="extendDomain"
                          label={{
                            value: `${th ? 'เป้า' : 'Target'} ${formatCompact(Number(currentTarget.target_value))}`,
                            position: 'right',
                            fill: '#b45309',
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        />
                        <Bar dataKey="actual" radius={[6, 6, 0, 0]} maxBarSize={72}>
                          {yearlyData.map((d, i) => (
                            <Cell
                              key={i}
                              fill={
                                d.status === 'on-track'
                                  ? '#10b981'
                                  : d.status === 'off-track'
                                    ? '#ef4444'
                                    : '#94a3b8'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-1 text-[10px]">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
                        <span className="text-muted-foreground">
                          {th ? 'บรรลุเป้า' : 'On track'}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-rose-500" />
                        <span className="text-muted-foreground">
                          {th ? 'ไม่บรรลุ' : 'Off track'}
                        </span>
                      </span>
                      {yearlyData.some((d) => d.status === 'no-target') && (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-sm bg-slate-400" />
                          <span className="text-muted-foreground">
                            {th ? 'ไม่ได้ตั้งเป้า' : 'No target'}
                          </span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <svg width="18" height="6" className="inline">
                          <line
                            x1="0"
                            y1="3"
                            x2="18"
                            y2="3"
                            stroke="#f59e0b"
                            strokeWidth="2"
                            strokeDasharray="3 2"
                          />
                        </svg>
                        <span className="text-muted-foreground">
                          {th ? `เป้าหมายปี ${currentYear}` : `Target line (${currentYear})`}
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-3 rounded-full bg-white/60 overflow-hidden ring-1 ring-border/40">
                    <div
                      className={`h-full transition-all ${
                        achievement.onTrack ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, achievement.pct))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {achievement.isLower
                      ? achievement.onTrack
                        ? th
                          ? '✓ อยู่ในเกณฑ์เป้าหมาย — ดีกว่าหรือเท่ากับเป้า'
                          : '✓ Within target — at or below goal'
                        : th
                        ? `⚠️ เกินเป้า ${(achievement.pct - 100).toFixed(1)}% (ทิศทาง: ยิ่งต่ำยิ่งดี)`
                        : `⚠️ Over target by ${(achievement.pct - 100).toFixed(1)}% (lower is better)`
                      : achievement.onTrack
                      ? th
                        ? '✓ บรรลุเป้าหมาย — มากกว่าหรือเท่ากับเป้า'
                        : '✓ Target met — at or above goal'
                      : th
                      ? `⚠️ ต่ำกว่าเป้า ${(100 - achievement.pct).toFixed(1)}% (ทิศทาง: ยิ่งสูงยิ่งดี)`
                      : `⚠️ Below target by ${(100 - achievement.pct).toFixed(1)}% (higher is better)`}
                  </p>
                </div>

                {currentTarget.note && (
                  <p className="text-[11px] text-muted-foreground italic mt-2 pt-2 border-t border-border/30">
                    💬 {currentTarget.note}
                  </p>
                )}
              </div>
            )}

            {/* No target hint */}
            {!currentTarget && (
              <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 px-4 py-3 flex items-start gap-3">
                <Target className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-amber-900">
                    {th ? 'ยังไม่ได้กำหนดเป้าหมายปี ' : 'No target set for '}
                    {currentYear}
                  </p>
                  <p className="text-xs text-amber-800/80 mt-0.5">
                    {th
                      ? 'กำหนดค่าเป้าหมายเพื่อติดตามความคืบหน้าและประเมินผลตามมาตรฐาน ESG'
                      : 'Define a target value to track progress and measure ESG performance'}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                  <Link to={`/master/targets?metric=${encodeURIComponent(metric.metric_id)}`}>
                    {th ? 'ตั้งค่า' : 'Set'}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ESGKeyIssues() {
  const { language } = useLanguage();
  const th = language === 'th';

  const [data, setData] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterDim, setFilterDim] = useState<string | null>(null);
  const [filterTheme, setFilterTheme] = useState<string | null>(null);
  const [filterMetric, setFilterMetric] = useState<string | null>(null);
  const [bigPictureOpen, setBigPictureOpen] = useState(false);

  // ── Deep-link: arrive via ?metric=ID and auto-select that metric ───────────
  const [searchParams, setSearchParams] = useSearchParams();
  const metricParamId = searchParams.get('metric');

  useEffect(() => {
    fetchData();
  }, []);

  // After data loads, if a ?metric=ID is present, locate it and set all
  // three filter levels so MetricHero shows. Then strip the URL param.
  useEffect(() => {
    if (!metricParamId || data.length === 0) return;
    for (const dim of data) {
      for (const theme of dim.themes) {
        const m = theme.metrics.find((mm) => mm.metric_id === metricParamId);
        if (m) {
          setFilterDim(dim.dimension_id);
          setFilterTheme(theme.theme_id);
          setFilterMetric(m.metric_id);
          const next = new URLSearchParams(searchParams);
          next.delete('metric');
          setSearchParams(next, { replace: true });
          return;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metricParamId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('esg_dimension')
        .select(`
          dimension_id, dimension_name,
          themes:esg_theme(
            theme_id, theme_name,
            metrics:esg_metric(metric_id, metric_name, unit)
          )
        `);
      if (error) throw error;
      const processed: Dimension[] = (rows ?? [])
        .map((d: any) => ({
          dimension_id: d.dimension_id,
          dimension_name: d.dimension_name,
          themes: (d.themes ?? [])
            .map((t: any) => ({
              theme_id: t.theme_id,
              theme_name: t.theme_name,
              metrics: (t.metrics ?? []).sort((a: any, b: any) =>
                a.metric_name.localeCompare(b.metric_name, 'th'),
              ),
            }))
            .sort((a: any, b: any) => a.theme_name.localeCompare(b.theme_name)),
        }))
        .sort((a, b) => {
          const ai = DIM_ORDER.indexOf(a.dimension_name);
          const bi = DIM_ORDER.indexOf(b.dimension_name);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
      setData(processed);
    } catch (e) {
      console.error('ESGKeyIssues fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDimClick = (id: string | null) => {
    setFilterDim(id);
    setFilterTheme(null);
    setFilterMetric(null);
  };
  const handleThemeClick = (id: string | null) => {
    setFilterTheme(id);
    setFilterMetric(null);
  };
  const handleMetricClick = (id: string | null) => setFilterMetric(id);
  const resetFilters = () => {
    setFilterDim(null);
    setFilterTheme(null);
    setFilterMetric(null);
  };

  // Click-from-card handler: sets all filter levels at once and scrolls to top
  // so the user sees the Filter chips update + the focused display appear.
  const handleSelectFromCard = (dimId: string, themeId: string, metricId?: string) => {
    setFilterDim(dimId);
    setFilterTheme(themeId);
    setFilterMetric(metricId ?? null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const dimContext = useMemo(
    () => (filterDim ? data.find((d) => d.dimension_id === filterDim) ?? null : null),
    [data, filterDim],
  );

  const themeContext = useMemo(() => {
    if (!filterTheme || !dimContext) return null;
    const t = dimContext.themes.find((t) => t.theme_id === filterTheme);
    return t ? { dim: dimContext, theme: t } : null;
  }, [dimContext, filterTheme]);

  const metricContext = useMemo(() => {
    if (!filterMetric || !themeContext) return null;
    const m = themeContext.theme.metrics.find((m) => m.metric_id === filterMetric);
    return m ? { dim: themeContext.dim, theme: themeContext.theme, metric: m } : null;
  }, [themeContext, filterMetric]);

  const hasFilter = !!(filterDim || filterTheme || filterMetric);

  const stats = useMemo(() => {
    const totalDims = data.length;
    const totalThemes = data.reduce((sum, d) => sum + d.themes.length, 0);
    const totalMetrics = data.reduce(
      (sum, d) => sum + d.themes.reduce((s, t) => s + t.metrics.length, 0),
      0,
    );
    return { totalDims, totalThemes, totalMetrics };
  }, [data]);

  const dimItems: ChipItem[] = useMemo(
    () => [
      { id: null, label: th ? 'ทั้งหมด' : 'All' },
      ...data.map((d) => ({ id: d.dimension_id, label: d.dimension_name })),
    ],
    [data, th],
  );

  const themeItems: ChipItem[] = useMemo(() => {
    if (!dimContext) return [];
    return [
      { id: null, label: th ? 'ทั้งหมด' : 'All' },
      ...dimContext.themes.map((t) => ({ id: t.theme_id, label: cleanThemeName(t.theme_name) })),
    ];
  }, [dimContext, th]);

  const metricItems: ChipItem[] = useMemo(() => {
    if (!themeContext) return [];
    return [
      { id: null, label: th ? 'ทั้งหมด' : 'All' },
      ...themeContext.theme.metrics.map((m) => ({ id: m.metric_id, label: m.metric_name })),
    ];
  }, [themeContext, th]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Network className="h-6 w-6 text-emerald-600" />
            {th ? 'ESG Key Issues' : 'ESG Key Issues'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {th
              ? 'โครงสร้างประเด็นความยั่งยืน (Materiality) ขององค์กร จัดเรียงตามลำดับขั้น Dimension → Theme → Metric — ใช้เป็นกรอบการวัดผลและรายงาน ESG'
              : 'Materiality structure organized as Dimension → Theme → Metric — the framework used for ESG measurement and reporting'}
          </p>
        </div>
        <Button
          onClick={() => setBigPictureOpen(true)}
          className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md shrink-0"
        >
          <LayoutGrid className="h-4 w-4" />
          {th ? 'ภาพรวมทั้งหมด' : 'Big Picture View'}
          <Download className="h-3 w-3 opacity-70" />
        </Button>
      </div>

      {/* Big picture modal */}
      <BigPictureModal data={data} open={bigPictureOpen} onClose={() => setBigPictureOpen(false)} th={th} />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Dimensions', value: stats.totalDims, icon: Layers3, color: 'text-emerald-600' },
          { label: 'Themes', value: stats.totalThemes, icon: Sparkles, color: 'text-blue-600' },
          { label: 'Metrics', value: stats.totalMetrics, icon: Hash, color: 'text-amber-600' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="glass-card-solid">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                  <Icon className={`h-7 w-7 opacity-50 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter card */}
      <Card className="glass-card-solid border-emerald-100">
        <CardContent className="py-4 px-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FilterIcon className="h-3.5 w-3.5" />
              {th ? 'กรองตามลำดับขั้น' : 'Filter by Hierarchy'}
            </span>
            {hasFilter && (
              <Button
                size="sm"
                variant="ghost"
                onClick={resetFilters}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" />
                {th ? 'ล้างตัวกรอง' : 'Clear all'}
              </Button>
            )}
          </div>

          <FilterRow
            icon={Layers3}
            label="Dimension"
            iconColor="text-emerald-600"
            color="emerald"
            items={dimItems}
            selected={filterDim}
            onChange={handleDimClick}
          />

          {dimContext && (
            <div className="ml-9 pl-3 border-l-2 border-dashed border-emerald-200">
              <FilterRow
                icon={Sparkles}
                label="Theme"
                iconColor="text-blue-600"
                color="blue"
                items={themeItems}
                selected={filterTheme}
                onChange={handleThemeClick}
              />
            </div>
          )}

          {themeContext && (
            <div className="ml-9 pl-3 border-l-2 border-dashed border-emerald-200">
              <div className="ml-9 pl-3 border-l-2 border-dashed border-blue-200">
                <FilterRow
                  icon={Hash}
                  label="Metric"
                  iconColor="text-amber-600"
                  color="amber"
                  items={metricItems}
                  selected={filterMetric}
                  onChange={handleMetricClick}
                />
              </div>
            </div>
          )}

          {!hasFilter ? (
            <p className="text-[11px] text-muted-foreground/70 italic pt-1">
              {th
                ? '💡 เลือก Dimension เพื่อดูรายละเอียดเชิงลึก — คลิก Metric เพื่อดู infographic + chart'
                : '💡 Pick a Dimension to drill down — click a Metric to see its infographic + charts'}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-1 border-t border-border/30 text-xs">
              <span className="font-semibold text-muted-foreground">
                {th ? 'กำลังกรอง:' : 'Filtering:'}
              </span>
              {dimContext && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 border-emerald-300 text-emerald-700">
                  <Layers3 className="h-2.5 w-2.5" />
                  {dimContext.dimension_name}
                </Badge>
              )}
              {themeContext && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                  <Badge variant="outline" className="text-[10px] gap-1 bg-blue-50 border-blue-300 text-blue-700">
                    <Sparkles className="h-2.5 w-2.5" />
                    {cleanThemeName(themeContext.theme.theme_name)}
                  </Badge>
                </>
              )}
              {metricContext && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                  <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 border-amber-300 text-amber-700 max-w-xs truncate">
                    <Hash className="h-2.5 w-2.5" />
                    {metricContext.metric.metric_name}
                  </Badge>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Display */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          {th ? 'ยังไม่มีข้อมูล Dimension' : 'No dimensions found'}
        </div>
      ) : metricContext ? (
        <MetricHero
          dim={metricContext.dim}
          theme={metricContext.theme}
          metric={metricContext.metric}
          th={th}
        />
      ) : themeContext ? (
        <DimensionCard
          dim={themeContext.dim}
          themesOverride={[themeContext.theme]}
          th={th}
          onSelect={handleSelectFromCard}
        />
      ) : dimContext ? (
        <DimensionCard dim={dimContext} th={th} onSelect={handleSelectFromCard} />
      ) : (
        <div className="space-y-5">
          {data.map((d) => (
            <DimensionCard
              key={d.dimension_id}
              dim={d}
              th={th}
              onSelect={handleSelectFromCard}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2 italic">
        {th
          ? '💡 ข้อมูลนี้สอดคล้องกับมาตรฐาน MSCI ESG Score และ GRI Standards'
          : '💡 Aligned with MSCI ESG Score framework and GRI Standards'}
      </p>
    </div>
  );
}

// ─── Big Picture Modal (MSCI-style one-page framework view) ──────────────────
function BigPictureModal({
  data,
  open,
  onClose,
  th,
}: {
  data: Dimension[];
  open: boolean;
  onClose: () => void;
  th: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`esg-framework-${dateStr}.pdf`);
    } catch (e) {
      console.error('PDF download error:', e);
    } finally {
      setDownloading(false);
    }
  };

  const dateLabel = new Date().toLocaleDateString(th ? 'th-TH' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-[1240px] w-[95vw] max-h-[95vh] p-0 overflow-hidden gap-0"
        style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}
      >
        <DialogHeader className="px-5 py-3 border-b border-border bg-white flex-row items-center justify-between space-y-0 gap-3">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-emerald-600" />
              {th ? 'ภาพรวม ESG Framework — One Page' : 'ESG Framework — Big Picture'}
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {th
                ? 'แผนผังโครงสร้างทั้งหมด พร้อมดาวน์โหลดเป็น PDF ที่พิมพ์ได้'
                : 'Complete materiality structure · ready to share & print'}
            </p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading
              ? th
                ? 'กำลังสร้าง...'
                : 'Preparing...'
              : th
              ? 'ดาวน์โหลด PDF'
              : 'Download PDF'}
          </Button>
        </DialogHeader>

        <div className="overflow-auto bg-slate-100" style={{ maxHeight: '85vh' }}>
          <div className="p-4 sm:p-6 min-w-[1120px]">
            <div
              ref={contentRef}
              className="bg-white rounded-xl shadow-xl mx-auto"
              style={{ width: '1100px', padding: '24px' }}
            >
              <BigPictureContent data={data} dateLabel={dateLabel} th={th} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Big Picture content (captured for PDF) ──────────────────────────────────
function BigPictureContent({
  data,
  dateLabel,
  th,
}: {
  data: Dimension[];
  dateLabel: string;
  th: boolean;
}) {
  const totalMetrics = data.reduce(
    (sum, d) => sum + d.themes.reduce((s, t) => s + t.metrics.length, 0),
    0,
  );
  const totalThemes = data.reduce((sum, d) => sum + d.themes.length, 0);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── Branded header ─────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              backgroundColor: '#10b981',
              borderRadius: '10px',
              height: '42px',
              width: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
            }}
          >
            <Leaf style={{ height: '22px', width: '22px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
              {th ? 'ESG Key Issues Framework' : 'ESG Key Issues Framework'}
            </h1>
            <p style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px', margin: 0 }}>
              {th
                ? 'NSL Foods PCL · โครงสร้างประเด็นความยั่งยืน (Materiality Structure)'
                : 'NSL Foods PCL · Materiality Structure'}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px', opacity: 0.85 }}>
          <p style={{ margin: 0, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {th ? 'จัดทำเมื่อ' : 'Generated'}
          </p>
          <p style={{ fontFamily: 'monospace', margin: 0, marginTop: '2px' }}>{dateLabel}</p>
          <p style={{ margin: 0, marginTop: '4px', fontSize: '10px', opacity: 0.7 }}>
            {data.length} Dimensions · {totalThemes} Themes · {totalMetrics} Metrics
          </p>
        </div>
      </div>

      {/* ── Pillar columns ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, 1fr)`,
          gap: '12px',
        }}
      >
        {data.map((dim) => (
          <DimensionColumnCompact key={dim.dimension_id} dim={dim} th={th} />
        ))}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '2px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#64748b',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles style={{ height: '12px', width: '12px' }} />
          {th
            ? 'สอดคล้องกับมาตรฐาน MSCI ESG Score และ GRI Standards'
            : 'Aligned with MSCI ESG Score framework and GRI Standards'}
        </span>
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>ESG Smart Performance</span>
      </div>
    </div>
  );
}

// ─── Compact pillar column for big-picture view ──────────────────────────────
function DimensionColumnCompact({ dim, th }: { dim: Dimension; th: boolean }) {
  const style = getStyle(dim.dimension_name);
  const Icon = style.icon;
  const metricCount = dim.themes.reduce((s, t) => s + t.metrics.length, 0);

  // Map dimension to explicit hex colors (html2canvas-safe)
  const colors: Record<string, { bg: string; from: string; to: string; lite: string; dot: string; border: string }> = {
    Environment: {
      bg: '#10b981',
      from: '#10b981',
      to: '#0f766e',
      lite: '#d1fae5',
      dot: '#10b981',
      border: '#86efac',
    },
    Social: {
      bg: '#3b82f6',
      from: '#3b82f6',
      to: '#0891b2',
      lite: '#dbeafe',
      dot: '#3b82f6',
      border: '#93c5fd',
    },
    Governance: {
      bg: '#f59e0b',
      from: '#f59e0b',
      to: '#d97706',
      lite: '#fef3c7',
      dot: '#f59e0b',
      border: '#fcd34d',
    },
    'General Information': {
      bg: '#64748b',
      from: '#64748b',
      to: '#475569',
      lite: '#f1f5f9',
      dot: '#64748b',
      border: '#cbd5e1',
    },
  };
  const c = colors[dim.dimension_name] ?? colors['General Information'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Pillar header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`,
          color: 'white',
          padding: '10px 12px',
          borderRadius: '10px 10px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon style={{ height: '16px', width: '16px', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.2, margin: 0 }}>
              {dim.dimension_name}
            </p>
            <p style={{ fontSize: '9px', opacity: 0.85, marginTop: '1px', margin: 0 }}>
              {dim.themes.length} {th ? 'หัวข้อ' : 'themes'} · {metricCount}{' '}
              {th ? 'ตัวชี้วัด' : 'metrics'}
            </p>
          </div>
        </div>
      </div>

      {/* Themes container */}
      <div
        style={{
          backgroundColor: c.lite,
          border: `1px solid ${c.border}`,
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flex: 1,
        }}
      >
        {dim.themes.map((theme) => (
          <ThemeBoxCompact key={theme.theme_id} theme={theme} color={c} />
        ))}
      </div>
    </div>
  );
}

function ThemeBoxCompact({
  theme,
  color,
}: {
  theme: Theme;
  color: { dot: string; border: string };
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '6px',
        border: `1px solid ${color.border}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          backgroundColor: '#f8fafc',
          padding: '5px 8px',
          borderBottom: `1px solid ${color.border}`,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {cleanThemeName(theme.theme_name)}
        </p>
      </div>
      <ul style={{ padding: '6px', margin: 0, listStyle: 'none' }}>
        {theme.metrics.map((m) => (
          <li
            key={m.metric_id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '4px',
              fontSize: '9px',
              color: '#334155',
              lineHeight: 1.35,
              marginBottom: '3px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                height: '5px',
                width: '5px',
                minWidth: '5px',
                borderRadius: '50%',
                backgroundColor: color.dot,
                marginTop: '4px',
                flexShrink: 0,
              }}
            />
            <span>{m.metric_name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
