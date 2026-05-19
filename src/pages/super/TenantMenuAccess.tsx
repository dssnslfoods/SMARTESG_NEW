import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  Building2,
  Loader2,
  Crown,
  Layers2,
  Lock,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { MENU_ITEMS } from '@/lib/menuConfig';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TenantOption {
  tenant_id: string;
  name: string;
  slug: string;
  plan: string;
  primary_color: string | null;
  is_active: boolean;
}

const SECTION_META: Record<string, { en: string; th: string; icon: string }> = {
  main:   { en: 'Main Menu',      th: 'เมนูหลัก',         icon: '📊' },
  master: { en: 'Master Data',    th: 'ข้อมูลหลัก',        icon: '🗂️' },
  admin:  { en: 'Administration', th: 'การจัดการระบบ',     icon: '⚙️' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function TenantMenuAccess() {
  const { language } = useLanguage();
  const { isSuperAdmin, user } = useAuth();
  const { toast } = useToast();
  const th = language === 'th';

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [allow, setAllow] = useState<Record<string, boolean>>({});
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingAllow, setLoadingAllow] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  // ── Fetch tenants ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoadingTenants(true);
    supabase
      .from('tenant')
      .select('tenant_id, name, slug, plan, primary_color, is_active')
      .order('name')
      .then(({ data }) => {
        const list = (data ?? []) as TenantOption[];
        setTenants(list);
        if (list.length > 0 && !selectedTenantId) {
          setSelectedTenantId(list[0].tenant_id);
        }
        setLoadingTenants(false);
      });
  }, [isSuperAdmin]);

  // ── Fetch allowlist for selected tenant ───────────────────────────────────
  useEffect(() => {
    if (!selectedTenantId) return;
    setLoadingAllow(true);
    supabase
      .from('tenant_menu_allowlist')
      .select('menu_key, is_allowed')
      .eq('tenant_id', selectedTenantId)
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        // Default every menu to true if not yet in DB
        MENU_ITEMS.forEach((m) => (map[m.key] = true));
        (data ?? []).forEach((row: any) => {
          map[row.menu_key] = row.is_allowed;
        });
        setAllow(map);
        setLoadingAllow(false);
      });
  }, [selectedTenantId]);

  // ── Toggle handler ────────────────────────────────────────────────────────
  const handleToggle = async (menuKey: string, newValue: boolean) => {
    if (!selectedTenantId || !user) return;
    const prev = allow[menuKey];

    // Optimistic
    setAllow((p) => ({ ...p, [menuKey]: newValue }));
    setSaving((p) => new Set(p).add(menuKey));

    try {
      const { error } = await supabase.from('tenant_menu_allowlist').upsert(
        {
          tenant_id: selectedTenantId,
          menu_key: menuKey,
          is_allowed: newValue,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,menu_key' },
      );
      if (error) throw error;
    } catch (e: any) {
      // Revert on error
      setAllow((p) => ({ ...p, [menuKey]: prev }));
      toast({
        variant: 'destructive',
        title: th ? 'ข้อผิดพลาด' : 'Error',
        description: e.message,
      });
    } finally {
      setSaving((p) => {
        const n = new Set(p);
        n.delete(menuKey);
        return n;
      });
    }
  };

  // ── Bulk: enable all / disable all (per current tenant) ──────────────────
  const handleSetAll = async (value: boolean) => {
    if (!selectedTenantId || !user) return;
    const rows = MENU_ITEMS.map((m) => ({
      tenant_id: selectedTenantId,
      menu_key: m.key,
      is_allowed: value,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }));
    try {
      const { error } = await supabase
        .from('tenant_menu_allowlist')
        .upsert(rows, { onConflict: 'tenant_id,menu_key' });
      if (error) throw error;
      setAllow(Object.fromEntries(MENU_ITEMS.map((m) => [m.key, value])));
      toast({
        title: th ? 'สำเร็จ' : 'Success',
        description: th
          ? value
            ? 'เปิดทุก menu สำหรับ tenant นี้แล้ว'
            : 'ปิดทุก menu สำหรับ tenant นี้แล้ว'
          : value
            ? 'All menus enabled for this tenant'
            : 'All menus disabled for this tenant',
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  // ── Group menus by section ────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const m = new Map<string, typeof MENU_ITEMS>();
    MENU_ITEMS.forEach((item) => {
      if (!m.has(item.section)) m.set(item.section, []);
      m.get(item.section)!.push(item);
    });
    return m;
  }, []);

  const stats = useMemo(() => {
    const total = MENU_ITEMS.length;
    const allowed = Object.values(allow).filter(Boolean).length;
    return { total, allowed };
  }, [allow]);

  const selectedTenant = tenants.find((t) => t.tenant_id === selectedTenantId);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <ShieldCheck className="h-12 w-12 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold text-foreground">
          {th ? 'เฉพาะ Super Admin' : 'Super Admin Only'}
        </h2>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Layers2 className="h-6 w-6 text-amber-500" />
          {th ? 'สิทธิ์ Menu ของ Tenant' : 'Tenant Menu Access'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">
          {th
            ? 'กำหนดว่า tenant แต่ละแห่งมีสิทธิ์เข้าถึง sidebar menu ใดบ้าง — เป็นชั้นบนสุด เหนือ menu_permission ที่ admin แต่ละ tenant ตั้งค่าเอง'
            : 'Control which sidebar menus each tenant can access — top-level allowlist that overrides the per-role menu_permission set by tenant admins'}
        </p>
      </div>

      {/* Two-tier info banner */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3 text-sm">
            <Crown className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 mb-1">
                {th ? '2 ระดับการควบคุม' : 'Two-Tier Permission Model'}
              </p>
              <ul className="text-xs text-amber-900/80 space-y-1">
                <li>
                  <strong>{th ? 'ระดับ 1 (คุณ — Super Admin):' : 'Tier 1 (you — Super Admin):'}</strong>{' '}
                  {th
                    ? 'กำหนดว่า tenant ใดเข้าถึง menu ใดได้บ้าง — ถ้าปิดที่นี่ admin ของ tenant จะเปิดเองไม่ได้'
                    : 'decide which menus each tenant can use at all — if disabled here, the tenant admin cannot turn it on'}
                </li>
                <li>
                  <strong>{th ? 'ระดับ 2 (Tenant Admin):' : 'Tier 2 (tenant admin):'}</strong>{' '}
                  {th
                    ? 'กำหนดว่า role ใดเห็น menu ใด — ภายใต้ menu ที่คุณอนุญาตเท่านั้น'
                    : "decide which roles see each menu — only among menus you've allowed"}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenant picker + stats */}
      <Card className="glass-card-solid">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {th ? 'เลือก Tenant' : 'Select Tenant'}
              </label>
              {loadingTenants ? (
                <div className="h-10 flex items-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {th ? 'กำลังโหลด...' : 'Loading...'}
                </div>
              ) : (
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.tenant_id} value={t.tenant_id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded"
                            style={{ backgroundColor: t.primary_color ?? '#10b981' }}
                          />
                          <span className="font-medium">{t.name}</span>
                          <Badge variant="outline" className="text-[9px] ml-1">
                            {t.plan}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-center min-w-[100px]">
                <p className="text-2xl font-bold text-emerald-700">{stats.allowed}</p>
                <p className="text-[10px] text-emerald-700/70 uppercase tracking-wider">
                  {th ? 'อนุญาต' : 'Allowed'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-center min-w-[100px]">
                <p className="text-2xl font-bold text-slate-700">
                  {stats.total - stats.allowed}
                </p>
                <p className="text-[10px] text-slate-700/70 uppercase tracking-wider">
                  {th ? 'ปิด' : 'Blocked'}
                </p>
              </div>
            </div>
          </div>

          {selectedTenant && (
            <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                {th ? 'กำลังจัดการ:' : 'Editing:'}{' '}
                <span className="font-mono font-semibold text-foreground">
                  {selectedTenant.slug}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetAll(true)}
                  disabled={loadingAllow}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  {th ? 'เปิดทุก menu' : 'Allow all'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetAll(false)}
                  disabled={loadingAllow}
                >
                  <Lock className="h-3.5 w-3.5 mr-1 text-rose-600" />
                  {th ? 'ปิดทุก menu' : 'Block all'}
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {!selectedTenantId ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              {th ? 'เลือก tenant ก่อน' : 'Select a tenant'}
            </div>
          ) : loadingAllow ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              {(['main', 'master', 'admin'] as const).map((section) => {
                const items = grouped.get(section) ?? [];
                const meta = SECTION_META[section];
                if (items.length === 0) return null;
                return (
                  <div key={section}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-base">{meta.icon}</span>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {th ? meta.th : meta.en}
                      </h3>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {items.map((item, idx) => {
                        const checked = allow[item.key] ?? true;
                        const isSaving = saving.has(item.key);
                        return (
                          <div
                            key={item.key}
                            className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${
                              idx > 0 ? 'border-t border-border/30' : ''
                            } ${checked ? 'bg-white' : 'bg-slate-50/60'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {th ? item.labelTh : item.label}
                              </p>
                              <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                                /{item.key}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Switch
                                  checked={checked}
                                  onCheckedChange={(v) => handleToggle(item.key, v)}
                                  className="data-[state=checked]:bg-emerald-600"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center italic">
        {th
          ? '💡 การเปลี่ยนแปลงมีผลทันที — ผู้ใช้ใน tenant นั้นจะเห็น sidebar ใหม่หลัง refresh หน้า'
          : '💡 Changes apply immediately. Users in that tenant will see the updated sidebar after a refresh.'}
      </p>
    </div>
  );
}
