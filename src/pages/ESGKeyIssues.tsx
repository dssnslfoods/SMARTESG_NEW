import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

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
  },
};

const FALLBACK_STYLE = STYLES['General Information'];

// Desired display order for dimensions
const DIM_ORDER = ['Environment', 'Social', 'Governance', 'General Information'];

// Strip "00." style prefix from theme names for cleaner display
const cleanThemeName = (s: string) => s.replace(/^\d+\.\s*/, '').trim();

// ─── Component ────────────────────────────────────────────────────────────────
export default function ESGKeyIssues() {
  const { language } = useLanguage();
  const th = language === 'th';

  const [data, setData] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Sort dimensions by DIM_ORDER, themes by theme_name (which has numeric prefix), metrics by name
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

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalDims = data.length;
    const totalThemes = data.reduce((sum, d) => sum + d.themes.length, 0);
    const totalMetrics = data.reduce(
      (sum, d) => sum + d.themes.reduce((s, t) => s + t.metrics.length, 0),
      0,
    );
    return { totalDims, totalThemes, totalMetrics };
  }, [data]);

  // ─── Render ───────────────────────────────────────────────────────────────
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
          {
            label: th ? 'Dimensions' : 'Dimensions',
            value: stats.totalDims,
            icon: Layers3,
            color: 'text-emerald-600',
          },
          {
            label: th ? 'Themes' : 'Themes',
            value: stats.totalThemes,
            icon: Sparkles,
            color: 'text-blue-600',
          },
          {
            label: th ? 'Metrics' : 'Metrics',
            value: stats.totalMetrics,
            icon: Hash,
            color: 'text-amber-600',
          },
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

      {/* Legend */}
      <Card className="glass-card-solid">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold text-muted-foreground">
              {th ? 'โครงสร้าง:' : 'Hierarchy:'}
            </span>
            <div className="flex items-center gap-1.5">
              <Layers3 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-foreground font-medium">Dimension</span>
              <span className="text-muted-foreground">{th ? '(มิติหลัก)' : '(top-level pillar)'}</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-foreground font-medium">Theme</span>
              <span className="text-muted-foreground">{th ? '(หัวข้อหลัก)' : '(key theme)'}</span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-foreground font-medium">Metric</span>
              <span className="text-muted-foreground">
                {th ? '(ตัวชี้วัด)' : '(measurable key issue)'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Org chart */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          {th ? 'ยังไม่มีข้อมูล Dimension' : 'No dimensions found'}
        </div>
      ) : (
        <div className="space-y-5">
          {data.map((dim) => {
            const style = STYLES[dim.dimension_name] ?? FALLBACK_STYLE;
            const Icon = style.icon;
            const metricCount = dim.themes.reduce((s, t) => s + t.metrics.length, 0);

            return (
              <Card
                key={dim.dimension_id}
                className="glass-card-solid overflow-hidden border-0 shadow-xl"
              >
                {/* ─── Dimension Banner ───────────────────────────────── */}
                <div
                  className={`relative bg-gradient-to-r ${style.bannerGradient} px-5 sm:px-7 py-4 sm:py-5 text-white overflow-hidden`}
                >
                  {/* decorative pattern */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div
                      className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white blur-3xl"
                    />
                    <div
                      className="absolute -bottom-12 left-1/3 w-32 h-32 rounded-full bg-white blur-3xl"
                    />
                  </div>

                  <div className="relative flex items-center gap-4">
                    <div className="rounded-2xl bg-white/25 backdrop-blur-sm p-3 ring-1 ring-white/30">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                        {dim.dimension_name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs sm:text-sm opacity-95">
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5" />
                          {dim.themes.length} {th ? 'หัวข้อหลัก' : 'themes'}
                        </span>
                        <span className="opacity-50">·</span>
                        <span className="flex items-center gap-1">
                          <Hash className="h-3.5 w-3.5" />
                          {metricCount} {th ? 'ตัวชี้วัด' : 'metrics'}
                        </span>
                      </div>
                    </div>

                    {/* Pillar label tag */}
                    <Badge
                      variant="secondary"
                      className="bg-white/25 text-white border-0 backdrop-blur-sm uppercase tracking-wider text-[10px] hidden sm:inline-flex"
                    >
                      {th ? 'เสาหลัก ESG' : 'ESG Pillar'}
                    </Badge>
                  </div>
                </div>

                {/* ─── Themes Grid (org chart columns) ────────────────── */}
                <CardContent
                  className={`p-3 sm:p-4 ${style.bannerBgPattern}`}
                >
                  {dim.themes.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6">
                      {th ? '(ไม่มี theme)' : '(no themes)'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {dim.themes.map((theme) => (
                        <div
                          key={theme.theme_id}
                          className={`rounded-2xl border-2 ${style.themeBorder} overflow-hidden bg-white/95 shadow-sm hover:shadow-md transition-shadow`}
                        >
                          {/* Theme header */}
                          <div
                            className={`${style.themeHeaderBg} px-3 py-2.5 border-b ${style.themeBorder} text-center`}
                          >
                            <h3
                              className={`text-sm font-bold ${style.themeHeaderText} leading-tight`}
                            >
                              {cleanThemeName(theme.theme_name)}
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                              <Hash className="h-2.5 w-2.5" />
                              {theme.metrics.length}{' '}
                              {th ? 'ตัวชี้วัด' : 'metrics'}
                            </p>
                          </div>

                          {/* Metric cards */}
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
                                    <span
                                      className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${style.accentDot} shrink-0`}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-slate-700 leading-snug">
                                        {m.metric_name}
                                      </p>
                                      {m.unit && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                          {m.unit}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
