/**
 * SuperAdminPanel — platform-wide overview rendered only for super_admin
 * callers. Data comes from two SECURITY DEFINER RPCs:
 *   • get_platform_overview()      — aggregated counts + monthly trend
 *   • get_tenant_activity_list()   — per-tenant rows
 *
 * The component is added at the top of Dashboard.tsx behind an isSuperAdmin
 * guard so it never renders for regular tenant users.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Crown,
  Building2,
  Users,
  Database,
  Activity,
  TrendingUp,
  AlertTriangle,
  ArrowRightCircle,
  RefreshCcw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlatformOverview {
  total_tenants: number;
  active_tenants: number;
  inactive_tenants: number;
  total_users: number;
  total_records: number;
  total_companies: number;
  total_sites: number;
  active_7d: number;
  active_30d: number;
  new_tenants_30d: number;
  plan_breakdown: Record<string, number>;
  trials_expiring: Array<{ tenant_id: string; name: string; days_left: number }>;
  monthly_entries: Array<{ month: string; count: number }>;
}
interface TenantActivityRow {
  tenant_id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  trial_ends_at: string | null;
  primary_color: string | null;
  users: number;
  records: number;
  companies: number;
  sites: number;
  last_activity: string | null;
  created_at: string;
}

const PLAN_STYLE: Record<string, { label: string; cls: string }> = {
  trial:      { label: 'Trial',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  standard:   { label: 'Standard',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  enterprise: { label: 'Enterprise', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString();
}

function relativeTime(iso: string | null, th: boolean): string {
  if (!iso) return th ? 'ยังไม่มีกิจกรรม' : 'No activity';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return th ? 'เมื่อสักครู่' : 'just now';
  if (mins < 60) return th ? `${mins} นาทีที่แล้ว` : `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return th ? `${hrs} ชั่วโมงที่แล้ว` : `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return th ? `${days} วันที่แล้ว` : `${days} d ago`;
  return new Date(iso).toLocaleDateString(th ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SuperAdminPanel() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const th = language === 'th';

  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [tenants, setTenants] = useState<TenantActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const [ovRes, listRes] = await Promise.all([
        supabase.rpc('get_platform_overview'),
        supabase.rpc('get_tenant_activity_list'),
      ]);
      if (ovRes.error) throw ovRes.error;
      if (listRes.error) throw listRes.error;
      setOverview(ovRes.data as PlatformOverview);
      setTenants((listRes.data ?? []) as TenantActivityRow[]);
    } catch (e) {
      console.error('SuperAdminPanel load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Switch into a tenant (same flow as TenantSwitcher: update profile + reload).
  const handleSwitch = async (tenantId: string) => {
    if (!user || switching || tenantId === profile?.tenant_id) return;
    setSwitching(tenantId);
    try {
      const { error } = await supabase
        .from('app_user_profile')
        .update({ tenant_id: tenantId })
        .eq('user_id', user.id);
      if (error) throw error;
      try { sessionStorage.removeItem(`auth_cache_${user.id}`); } catch { /* ignore */ }
      window.location.reload();
    } catch (e) {
      console.error('Switch tenant error:', e);
      setSwitching(null);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6">
        <div className="flex items-center justify-center py-8 text-amber-600">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          {th ? 'กำลังโหลดข้อมูล Platform...' : 'Loading platform overview...'}
        </div>
      </section>
    );
  }

  if (!overview) return null;

  return (
    <section className="space-y-4">
      {/* ── Section header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 shadow-md">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              {th ? 'ภาพรวมแพลตฟอร์ม' : 'Platform Overview'}
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px] uppercase tracking-wider">
                Super Admin
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {th ? 'ภาพรวมระบบทุก tenant — ข้อมูลที่เห็นเฉพาะ super admin เท่านั้น' : 'Cross-tenant system health — visible to super admins only'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing} className="gap-1.5 border-amber-200">
          <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {th ? 'รีเฟรช' : 'Refresh'}
        </Button>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Building2}
          color="from-blue-500 to-indigo-600"
          label={th ? 'Tenants ทั้งหมด' : 'Total Tenants'}
          value={fmtNum(overview.total_tenants)}
          sub={`${overview.active_tenants} ${th ? 'ใช้งาน' : 'active'} · ${overview.inactive_tenants} ${th ? 'ระงับ' : 'inactive'}`}
        />
        <KpiCard
          icon={Users}
          color="from-emerald-500 to-teal-600"
          label={th ? 'ผู้ใช้ทั้งหมด' : 'Total Users'}
          value={fmtNum(overview.total_users)}
          sub={th ? 'ทุก tenant รวมกัน' : 'across all tenants'}
        />
        <KpiCard
          icon={Database}
          color="from-purple-500 to-fuchsia-600"
          label={th ? 'รายการข้อมูล' : 'Total Records'}
          value={fmtNum(overview.total_records)}
          sub={`${overview.total_companies} ${th ? 'บริษัท' : 'companies'} · ${overview.total_sites} ${th ? 'สถานที่' : 'sites'}`}
        />
        <KpiCard
          icon={Activity}
          color="from-amber-500 to-orange-600"
          label={th ? 'Active (7 วัน)' : 'Active (7 days)'}
          value={`${overview.active_7d}/${overview.total_tenants}`}
          sub={`+${overview.new_tenants_30d} ${th ? 'tenant ใหม่ใน 30 วัน' : 'new tenants in 30d'}`}
        />
      </div>

      {/* ── Plan distribution + Trial alerts ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Plan breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {th ? 'การกระจาย Plan' : 'Plan Distribution'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(['trial','standard','enterprise'] as const).map(plan => {
              const n = overview.plan_breakdown?.[plan] ?? 0;
              const pct = overview.total_tenants > 0 ? (n / overview.total_tenants) * 100 : 0;
              const style = PLAN_STYLE[plan];
              return (
                <div key={plan} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.cls}`}>{style.label}</span>
                    <span className="font-mono text-muted-foreground">{n} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        plan === 'trial' ? 'bg-blue-400' : plan === 'standard' ? 'bg-emerald-400' : 'bg-purple-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Trial expiring alert */}
        <Card className={`lg:col-span-2 ${overview.trials_expiring.length > 0 ? 'border-amber-300 bg-amber-50/40' : ''}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <AlertTriangle className={`h-3.5 w-3.5 ${overview.trials_expiring.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              {th ? 'Trial ใกล้หมดอายุ (30 วัน)' : 'Trials Expiring (30 days)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview.trials_expiring.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                {th ? '✅ ไม่มี trial ที่ใกล้หมดอายุ' : '✅ No trials expiring soon'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {overview.trials_expiring.map(t => (
                  <li key={t.tenant_id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-amber-200">
                    <span className="font-medium text-slate-800">{t.name}</span>
                    <Badge variant="outline" className={`${t.days_left <= 7 ? 'border-red-300 text-red-600 bg-red-50' : 'border-amber-300 text-amber-700 bg-amber-50'}`}>
                      {th ? `เหลือ ${t.days_left} วัน` : `${t.days_left} days left`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Per-tenant activity table ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-blue-500" />
            {th ? 'กิจกรรมรายตัว Tenant' : 'Per-Tenant Activity'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground bg-gray-50/50">
                  <th className="px-4 py-2.5 font-semibold">Tenant</th>
                  <th className="px-2 py-2.5 font-semibold">Plan</th>
                  <th className="px-2 py-2.5 font-semibold text-right">{th ? 'ผู้ใช้' : 'Users'}</th>
                  <th className="px-2 py-2.5 font-semibold text-right">{th ? 'ข้อมูล' : 'Records'}</th>
                  <th className="px-2 py-2.5 font-semibold text-right">{th ? 'บริษัท' : 'Co.'}</th>
                  <th className="px-2 py-2.5 font-semibold text-right">{th ? 'สถานที่' : 'Sites'}</th>
                  <th className="px-2 py-2.5 font-semibold">{th ? 'กิจกรรมล่าสุด' : 'Last Activity'}</th>
                  <th className="px-2 py-2.5 font-semibold text-center">{th ? 'สถานะ' : 'Status'}</th>
                  <th className="px-2 py-2.5 font-semibold text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map(t => {
                  const isCurrent = t.tenant_id === profile?.tenant_id;
                  const planStyle = PLAN_STYLE[t.plan];
                  return (
                    <tr key={t.tenant_id} className={`text-slate-700 hover:bg-slate-50 ${isCurrent ? 'bg-emerald-50/40' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: t.primary_color ?? '#10b981' }}
                          >
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">{t.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{t.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${planStyle?.cls ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {planStyle?.label ?? t.plan}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">{fmtNum(t.users)}</td>
                      <td className="px-2 py-2.5 text-right font-mono font-semibold">{fmtNum(t.records)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-muted-foreground">{t.companies}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-muted-foreground">{t.sites}</td>
                      <td className="px-2 py-2.5 text-xs text-muted-foreground">{relativeTime(t.last_activity, th)}</td>
                      <td className="px-2 py-2.5 text-center">
                        {!t.is_active ? (
                          <span className="text-[10px] text-red-500 font-semibold">{th ? 'ระงับ' : 'Inactive'}</span>
                        ) : isCurrent ? (
                          <span className="text-[10px] text-emerald-600 font-semibold">{th ? 'กำลังดู' : 'Viewing'}</span>
                        ) : (
                          <span className="text-[10px] text-emerald-600">{th ? 'ใช้งาน' : 'Active'}</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1"
                          disabled={isCurrent || !!switching}
                          onClick={() => handleSwitch(t.tenant_id)}
                          title={th ? 'สลับเข้าดู tenant นี้' : 'Switch to this tenant'}
                        >
                          {switching === t.tenant_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightCircle className="h-3 w-3" />}
                          {th ? 'เข้าดู' : 'View'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Monthly entries trend ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            {th ? 'แนวโน้มการบันทึกข้อมูล (12 เดือน)' : 'Data Entry Trend (Last 12 Months)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={overview.monthly_entries} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(m: string) => m?.slice(2)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtNum(v)} />
                <ReTooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(v: number) => [fmtNum(v), th ? 'รายการ' : 'records']}
                />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ─── KPI card sub-component ───────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: typeof Building2;
  color: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
          <div className={`rounded-lg bg-gradient-to-br ${color} p-1.5 shadow-sm`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{sub}</p>
      </CardContent>
    </Card>
  );
}
