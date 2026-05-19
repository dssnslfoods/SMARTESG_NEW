import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const [target, setTarget] = useState<TargetRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const currentYear = new Date().getFullYear();
        const [valuesRes, targetRes] = await Promise.all([
          supabase
            .from('metric_value')
            .select(`
              value, status,
              period:period_id(year, month),
              site:site_id(site_id, site_name)
            `)
            .eq('metric_id', metric.metric_id)
            .in('status', ['approved', 'submitted']),
          supabase
            .from('metric_target')
            .select('target_value, target_direction, note')
            .eq('metric_id', metric.metric_id)
            .eq('year', currentYear)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setValues((valuesRes.data ?? []) as any);
        setTarget((targetRes.data ?? null) as any);
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
    return { total, avg, latest, count: values.length, siteCount: uniqueSites.size };
  }, [values]);

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

  const achievement = useMemo(() => {
    if (!target || !stats) return null;
    const pct = target.target_value === 0 ? 0 : (stats.total / target.target_value) * 100;
    const isLower = target.target_direction === 'lower_is_better';
    const onTrack = isLower ? stats.total <= target.target_value : stats.total >= target.target_value;
    return { pct, onTrack, isLower };
  }, [target, stats]);

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
            {target && achievement && (
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
                        target.target_direction === 'higher_is_better'
                          ? 'border-emerald-300 text-emerald-700 bg-white/50'
                          : 'border-blue-300 text-blue-700 bg-white/50'
                      }`}
                    >
                      {target.target_direction === 'higher_is_better' ? (
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

                {/* Actual vs Target values */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {th ? 'ค่าจริง (สะสม)' : 'Actual (cumulative)'}
                    </p>
                    <p className={`text-lg font-bold mt-0.5 ${style.heroAccent}`}>
                      {formatCompact(stats!.total)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {th ? `เป้าหมายปี ${new Date().getFullYear()}` : `Target ${new Date().getFullYear()}`}
                    </p>
                    <p className="text-lg font-bold mt-0.5 text-foreground">
                      {formatCompact(target.target_value)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                    </p>
                  </div>
                </div>

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

                {target.note && (
                  <p className="text-[11px] text-muted-foreground italic mt-2 pt-2 border-t border-border/30">
                    💬 {target.note}
                  </p>
                )}
              </div>
            )}

            {/* No target hint */}
            {!target && (
              <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 px-4 py-3 flex items-start gap-3">
                <Target className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-amber-900">
                    {th ? 'ยังไม่ได้กำหนดเป้าหมายปี ' : 'No target set for '}
                    {new Date().getFullYear()}
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
      <div>
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
