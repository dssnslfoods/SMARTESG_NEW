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
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

// ─── Visual styling per dimension ─────────────────────────────────────────────
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
  },
};

const FALLBACK_STYLE = STYLES['General Information'];

const DIM_ORDER = ['Environment', 'Social', 'Governance', 'General Information'];

const cleanThemeName = (s: string) => s.replace(/^\d+\.\s*/, '').trim();

const getStyle = (name: string) => STYLES[name] ?? FALLBACK_STYLE;

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

// ─── Filter Row ───────────────────────────────────────────────────────────────
function FilterRow({
  icon: Icon,
  label,
  hintText,
  items,
  selected,
  onChange,
  color,
  iconColor,
}: {
  icon: typeof Layers3;
  label: string;
  hintText?: string;
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
        {hintText && items.length <= 1 && (
          <span className="text-[11px] text-muted-foreground/60 italic self-center pl-1">
            {hintText}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Theme column renderer ───────────────────────────────────────────────────
function ThemeColumn({ theme, style, th }: { theme: Theme; style: DimStyle; th: boolean }) {
  return (
    <div
      className={`rounded-2xl border-2 ${style.themeBorder} overflow-hidden bg-white/95 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className={`${style.themeHeaderBg} px-3 py-2.5 border-b ${style.themeBorder} text-center`}>
        <h3 className={`text-sm font-bold ${style.themeHeaderText} leading-tight`}>
          {cleanThemeName(theme.theme_name)}
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
          <Hash className="h-2.5 w-2.5" />
          {theme.metrics.length} {th ? 'ตัวชี้วัด' : 'metrics'}
        </p>
      </div>
      <div className="p-2 space-y-1.5">
        {theme.metrics.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 text-center py-3 italic">
            {th ? '(ยังไม่มีตัวชี้วัด)' : '(no metrics)'}
          </p>
        ) : (
          theme.metrics.map((m) => (
            <div
              key={m.metric_id}
              className={`rounded-lg border ${style.metricBg} ${style.metricHover} px-2.5 py-2 transition-all cursor-default`}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${style.accentDot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 leading-snug">{m.metric_name}</p>
                  {m.unit && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{m.unit}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Dimension card renderer ─────────────────────────────────────────────────
function DimensionCard({
  dim,
  themesOverride,
  th,
}: {
  dim: Dimension;
  themesOverride?: Theme[];
  th: boolean;
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
              <ThemeColumn key={t.theme_id} theme={t} style={style} th={th} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Metric hero card ────────────────────────────────────────────────────────
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

      <CardContent className={`py-8 px-6 ${style.bannerBgPattern} text-center`}>
        <div className={`inline-flex items-center justify-center h-16 w-16 rounded-full ${style.accentDot}/10 mb-3`}>
          <Hash className={`h-8 w-8 ${style.heroAccent}`} />
        </div>

        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2 font-mono">
          {metric.metric_id}
        </p>

        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground max-w-3xl mx-auto leading-tight">
          {metric.metric_name}
        </h2>

        {metric.unit && (
          <div className="mt-4 flex justify-center">
            <Badge variant="outline" className="text-sm font-mono px-3 py-1 bg-white/70 backdrop-blur-sm">
              {th ? 'หน่วย: ' : 'Unit: '}
              <span className={`ml-1 font-bold ${style.heroAccent}`}>{metric.unit}</span>
            </Badge>
          </div>
        )}

        <p className="mt-5 text-xs text-muted-foreground italic max-w-md mx-auto">
          {th
            ? 'ตัวชี้วัด (Key Issue) ที่สามารถวัดผลและรายงานความคืบหน้าได้ตามมาตรฐาน ESG'
            : 'A measurable Key Issue tracked and reported against ESG standards'}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/data-entry">
              <FileInput className="h-3.5 w-3.5" />
              {th ? 'บันทึกข้อมูล' : 'Data Entry'}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/master/targets">
              <Target className="h-3.5 w-3.5" />
              {th ? 'กำหนดเป้าหมาย' : 'Set KPI Target'}
            </Link>
          </Button>
        </div>
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

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterDim, setFilterDim] = useState<string | null>(null);
  const [filterTheme, setFilterTheme] = useState<string | null>(null);
  const [filterMetric, setFilterMetric] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, []);

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

  // ── Cascade handlers ──────────────────────────────────────────────────────
  const handleDimClick = (id: string | null) => {
    setFilterDim(id);
    setFilterTheme(null);
    setFilterMetric(null);
  };
  const handleThemeClick = (id: string | null) => {
    setFilterTheme(id);
    setFilterMetric(null);
  };
  const handleMetricClick = (id: string | null) => {
    setFilterMetric(id);
  };
  const resetFilters = () => {
    setFilterDim(null);
    setFilterTheme(null);
    setFilterMetric(null);
  };

  // ── Derived contexts ──────────────────────────────────────────────────────
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

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalDims = data.length;
    const totalThemes = data.reduce((sum, d) => sum + d.themes.length, 0);
    const totalMetrics = data.reduce(
      (sum, d) => sum + d.themes.reduce((s, t) => s + t.metrics.length, 0),
      0,
    );
    return { totalDims, totalThemes, totalMetrics };
  }, [data]);

  // ── Chip items ────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
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
          { label: th ? 'Dimensions' : 'Dimensions', value: stats.totalDims, icon: Layers3, color: 'text-emerald-600' },
          { label: th ? 'Themes' : 'Themes', value: stats.totalThemes, icon: Sparkles, color: 'text-blue-600' },
          { label: th ? 'Metrics' : 'Metrics', value: stats.totalMetrics, icon: Hash, color: 'text-amber-600' },
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

      {/* ─── Interactive Filter (mindmap drill-down) ─────────────────────── */}
      <Card className="glass-card-solid border-emerald-100">
        <CardContent className="py-4 px-4 space-y-3">
          {/* Title row */}
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

          {/* Dimension row */}
          <FilterRow
            icon={Layers3}
            label="Dimension"
            iconColor="text-emerald-600"
            color="emerald"
            items={dimItems}
            selected={filterDim}
            onChange={handleDimClick}
          />

          {/* Theme row — only when dim selected */}
          {dimContext && (
            <>
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
            </>
          )}

          {/* Metric row — only when theme selected */}
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

          {/* Breadcrumb + hint */}
          {!hasFilter ? (
            <p className="text-[11px] text-muted-foreground/70 italic pt-1">
              {th
                ? '💡 เลือก Dimension เพื่อดูรายละเอียดเชิงลึก — คลิกเพื่อ drill down ทีละขั้น'
                : '💡 Pick a Dimension to drill down — click any chip to explore deeper'}
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

      {/* ─── Filtered display below ──────────────────────────────────────── */}
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
        <DimensionCard dim={themeContext.dim} themesOverride={[themeContext.theme]} th={th} />
      ) : dimContext ? (
        <DimensionCard dim={dimContext} th={th} />
      ) : (
        <div className="space-y-5">
          {data.map((d) => (
            <DimensionCard key={d.dimension_id} dim={d} th={th} />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pt-2 italic">
        {th
          ? '💡 ข้อมูลนี้สอดคล้องกับมาตรฐาน MSCI ESG Score และ GRI Standards'
          : '💡 Aligned with MSCI ESG Score framework and GRI Standards'}
      </p>
    </div>
  );
}
