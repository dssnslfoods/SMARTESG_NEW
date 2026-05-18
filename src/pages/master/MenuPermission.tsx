import { useEffect, useState, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useMenuPermissions } from '@/contexts/MenuPermissionsContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  LayoutGrid,
  Lock,
  Loader2,
  ShieldCheck,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MENU_ITEMS, NON_ADMIN_ROLES, DEFAULT_PERMISSIONS, type AppRole } from '@/lib/menuConfig';

// ─── Types ────────────────────────────────────────────────────────────────────
type PermState = Record<string, Record<string, boolean>>;
type SavingSet = Set<string>; // "menuKey:role"

const ROLE_LABELS: Record<AppRole, { en: string; th: string; color: string }> = {
  admin:      { en: 'Admin',      th: 'ผู้ดูแล',      color: 'bg-red-100 text-red-700 border-red-200' },
  supervisor: { en: 'Supervisor', th: 'หัวหน้างาน',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  executive:  { en: 'Executive',  th: 'ผู้บริหาร',     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  staff:      { en: 'Staff',      th: 'พนักงาน',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  guest:      { en: 'Guest',      th: 'ผู้เยี่ยมชม',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const SECTION_META = {
  main:   { en: 'Main Menu',      th: 'เมนูหลัก',          icon: '📊' },
  master: { en: 'Master Data',    th: 'ข้อมูลหลัก',         icon: '🗂️' },
  admin:  { en: 'Administration', th: 'การจัดการระบบ',      icon: '⚙️' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function MenuPermission() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { allPermissions, refresh: refreshContext, loading: ctxLoading } = useMenuPermissions();
  const th = language === 'th';

  // Local full permission state (all menu × non-admin roles)
  const [perms, setPerms] = useState<PermState>({});
  const [saving, setSaving] = useState<SavingSet>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Build full local state from context (with default fallback)
  useEffect(() => {
    if (ctxLoading) return;
    const state: PermState = {};
    MENU_ITEMS.forEach((item) => {
      state[item.key] = {};
      NON_ADMIN_ROLES.forEach((role) => {
        const fromCtx = allPermissions[item.key]?.[role];
        state[item.key][role] =
          fromCtx !== undefined
            ? fromCtx
            : (DEFAULT_PERMISSIONS[item.key] ?? []).includes(role);
      });
    });
    setPerms(state);
    setInitialized(true);
  }, [allPermissions, ctxLoading]);

  // ── Toggle handler ──────────────────────────────────────────────────────────
  const handleToggle = async (menuKey: string, role: AppRole, newValue: boolean) => {
    const cellId = `${menuKey}:${role}`;

    // Optimistic update
    setPerms((prev) => ({
      ...prev,
      [menuKey]: { ...prev[menuKey], [role]: newValue },
    }));
    setSaving((prev) => new Set(prev).add(cellId));

    try {
      const { error } = await supabase.from('menu_permission').upsert(
        { menu_key: menuKey, role, is_active: newValue, updated_at: new Date().toISOString() },
        { onConflict: 'menu_key,role' },
      );
      if (error) throw error;

      // Propagate to Sidebar (update context)
      await refreshContext();
    } catch (e: any) {
      // Revert on error
      setPerms((prev) => ({
        ...prev,
        [menuKey]: { ...prev[menuKey], [role]: !newValue },
      }));
      toast({
        variant: 'destructive',
        title: th ? 'ข้อผิดพลาด' : 'Error',
        description: e.message,
      });
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(cellId);
        return next;
      });
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalOn = 0;
    let total = 0;
    MENU_ITEMS.forEach((item) => {
      NON_ADMIN_ROLES.forEach((role) => {
        total++;
        if (perms[item.key]?.[role]) totalOn++;
      });
    });
    return { totalOn, total };
  }, [perms]);

  // ── Group items by section ──────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, typeof MENU_ITEMS>();
    MENU_ITEMS.forEach((item) => {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    });
    return map;
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-emerald-600" />
          {th ? 'กำหนดสิทธิ์เมนู' : 'Menu Permissions'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {th
            ? 'กำหนดว่า Role ไหนสามารถเห็นเมนูใดใน Sidebar ได้บ้าง — มีผลทันทีเมื่อสลับ'
            : 'Control which roles can see which sidebar menu items — changes apply instantly'}
        </p>
      </div>

      {/* Notice + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="glass-card-solid sm:col-span-2">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-foreground mb-0.5">
                  {th ? 'Admin เห็นทุกเมนูเสมอ' : 'Admin always has full access'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {th
                    ? 'สิทธิ์ของ Admin ไม่สามารถปรับเปลี่ยนได้ผ่านหน้านี้ การตั้งค่านี้ควบคุมเฉพาะการแสดงผลเมนูเท่านั้น'
                    : 'Admin permissions cannot be changed here. This page controls sidebar visibility only — page access is still governed by role.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card-solid">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.totalOn}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {th ? `เปิดใช้งาน / ${stats.total} รายการ` : `Enabled / ${stats.total} total`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Matrix */}
      {!initialized ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="glass-card-solid">
          <CardContent className="pt-4 px-0 pb-2 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              {/* Column headers */}
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 pb-3 text-xs font-semibold text-muted-foreground w-56">
                    {th ? 'เมนู' : 'Menu Item'}
                  </th>
                  {/* Admin column — locked */}
                  <th className="pb-3 px-3 text-center">
                    <Badge
                      variant="outline"
                      className={`text-xs gap-1 ${ROLE_LABELS.admin.color}`}
                    >
                      <Lock className="h-3 w-3" />
                      {th ? 'Admin' : 'Admin'}
                    </Badge>
                  </th>
                  {NON_ADMIN_ROLES.map((role) => (
                    <th key={role} className="pb-3 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-xs ${ROLE_LABELS[role].color}`}
                      >
                        {th ? ROLE_LABELS[role].th : ROLE_LABELS[role].en}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {(['main', 'master', 'admin'] as const).map((section) => {
                  const items = grouped.get(section) ?? [];
                  const meta = SECTION_META[section];
                  return items.map((item, idx) => (
                    <>
                      {/* Section header row */}
                      {idx === 0 && (
                        <tr key={`section-${section}`} className="bg-muted/20">
                          <td
                            colSpan={2 + NON_ADMIN_ROLES.length}
                            className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
                          >
                            {meta.icon}{' '}
                            {th ? meta.th : meta.en}
                          </td>
                        </tr>
                      )}
                      {/* Menu item row */}
                      <tr
                        key={item.key}
                        className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                      >
                        {/* Menu name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            <span className="text-xs font-medium text-foreground">
                              {th ? item.labelTh : item.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 pl-5 mt-0.5 font-mono">
                            /{item.key}
                          </p>
                        </td>

                        {/* Admin — always ON, locked */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <Lock className="h-3.5 w-3.5 text-red-400" />
                          </div>
                        </td>

                        {/* Non-admin roles */}
                        {NON_ADMIN_ROLES.map((role) => {
                          const cellId = `${item.key}:${role}`;
                          const isSaving = saving.has(cellId);
                          const isOn = perms[item.key]?.[role] ?? false;
                          return (
                            <td key={role} className="px-3 py-3 text-center">
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                              ) : (
                                <Switch
                                  checked={isOn}
                                  onCheckedChange={(v) => handleToggle(item.key, role, v)}
                                  className="mx-auto data-[state=checked]:bg-emerald-600"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  ));
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Refresh hint */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        {th
          ? '💡 การเปลี่ยนแปลงมีผลทันที — ผู้ใช้ที่ล็อกอินอยู่จะเห็นเมนูใหม่หลัง refresh หน้า'
          : '💡 Changes apply immediately. Logged-in users will see updated menus after a page refresh.'}
      </p>
    </div>
  );
}
