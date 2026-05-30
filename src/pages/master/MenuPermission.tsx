import { useEffect, useState, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
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
  RotateCcw,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  const { profile } = useAuth();
  const { toast } = useToast();
  const {
    allPermissions,
    tenantAllowlist,
    refresh: refreshContext,
    loading: ctxLoading,
  } = useMenuPermissions();

  // The admin's own tenant — every write is scoped to this id explicitly so a
  // tenant can never modify another tenant's menu permissions.
  const tenantId = profile?.tenant_id ?? null;

  // Only show menus the super_admin has allowed for this tenant.
  // A menu missing from tenantAllowlist defaults to allowed (true).
  const visibleMenuItems = useMemo(
    () => MENU_ITEMS.filter((m) => tenantAllowlist[m.key] !== false),
    [tenantAllowlist],
  );
  const blockedCount = MENU_ITEMS.length - visibleMenuItems.length;
  const th = language === 'th';

  // Local full permission state (all menu × non-admin roles)
  const [perms, setPerms] = useState<PermState>({});
  const [saving, setSaving] = useState<SavingSet>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Build full local state from context (with default fallback)
  useEffect(() => {
    if (ctxLoading) return;
    const state: PermState = {};
    visibleMenuItems.forEach((item) => {
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
  }, [allPermissions, ctxLoading, visibleMenuItems]);

  // ── Toggle handler ──────────────────────────────────────────────────────────
  const handleToggle = async (menuKey: string, role: AppRole, newValue: boolean) => {
    const cellId = `${menuKey}:${role}`;
    if (!tenantId) return;

    // Optimistic update
    setPerms((prev) => ({
      ...prev,
      [menuKey]: { ...prev[menuKey], [role]: newValue },
    }));
    setSaving((prev) => new Set(prev).add(cellId));

    try {
      // tenant_id is set EXPLICITLY and onConflict matches the real PK
      // (tenant_id, menu_key, role) — so writes never collide across tenants.
      const { error } = await supabase.from('menu_permission').upsert(
        {
          tenant_id: tenantId,
          menu_key: menuKey,
          role,
          is_active: newValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,menu_key,role' },
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

  // ── Reset all permissions to the system defaults (this tenant only) ─────────
  const [resetting, setResetting] = useState(false);
  const handleResetDefaults = async () => {
    if (!tenantId) return;
    setResetting(true);
    try {
      // Build one row per (visible menu × non-admin role) from DEFAULT_PERMISSIONS.
      const rows = visibleMenuItems.flatMap((item) =>
        NON_ADMIN_ROLES.map((role) => ({
          tenant_id: tenantId,
          menu_key: item.key,
          role,
          is_active: (DEFAULT_PERMISSIONS[item.key] ?? []).includes(role),
          updated_at: new Date().toISOString(),
        })),
      );

      const { error } = await supabase
        .from('menu_permission')
        .upsert(rows, { onConflict: 'tenant_id,menu_key,role' });
      if (error) throw error;

      // Reflect immediately in local state + Sidebar
      const next: PermState = {};
      visibleMenuItems.forEach((item) => {
        next[item.key] = {};
        NON_ADMIN_ROLES.forEach((role) => {
          next[item.key][role] = (DEFAULT_PERMISSIONS[item.key] ?? []).includes(role);
        });
      });
      setPerms(next);
      await refreshContext();

      toast({
        title: th ? 'คืนค่าสำเร็จ' : 'Reset complete',
        description: th
          ? 'สิทธิ์เมนูทั้งหมดถูกตั้งกลับเป็นค่าเริ่มต้นของระบบแล้ว'
          : 'All menu permissions restored to system defaults.',
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: th ? 'ข้อผิดพลาด' : 'Error',
        description: e.message,
      });
    } finally {
      setResetting(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalOn = 0;
    let total = 0;
    visibleMenuItems.forEach((item) => {
      NON_ADMIN_ROLES.forEach((role) => {
        total++;
        if (perms[item.key]?.[role]) totalOn++;
      });
    });
    return { totalOn, total };
  }, [perms, visibleMenuItems]);

  // ── Group items by section ──────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, typeof MENU_ITEMS>();
    visibleMenuItems.forEach((item) => {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    });
    return map;
  }, [visibleMenuItems]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-emerald-600" />
            {th ? 'กำหนดสิทธิ์เมนู' : 'Menu Permissions'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {th
              ? 'กำหนดว่า Role ไหนสามารถเห็นเมนูใดใน Sidebar ได้บ้าง — มีผลทันที เฉพาะ tenant ของคุณเท่านั้น'
              : 'Control which roles can see which sidebar menu items — applies instantly, your tenant only'}
          </p>
        </div>

        {/* Reset to system defaults */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={resetting || !initialized} className="gap-1.5 shrink-0">
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {th ? 'คืนค่าเริ่มต้นของระบบ' : 'Reset to System Defaults'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {th ? 'คืนค่าสิทธิ์เมนูเป็นค่าเริ่มต้น?' : 'Reset menu permissions to defaults?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {th
                  ? 'การตั้งค่าสิทธิ์เมนูทั้งหมดของ tenant นี้จะถูกเปลี่ยนกลับเป็นค่าเริ่มต้นที่ระบบกำหนด การกระทำนี้มีผลเฉพาะ tenant ของคุณ และไม่กระทบ tenant อื่น'
                  : 'All menu permission settings for this tenant will revert to the system-defined defaults. This affects only your tenant and cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{th ? 'ยกเลิก' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetDefaults}>
                {th ? 'คืนค่าเริ่มต้น' : 'Reset to Defaults'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

      {/* Super-admin allowlist notice — only shown if any menus are blocked */}
      {blockedCount > 0 && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="py-2.5 px-4 flex items-start gap-3 text-sm">
            <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-amber-900 font-semibold mb-0.5">
                {th
                  ? `Super Admin ปิดการเข้าถึง ${blockedCount} menu สำหรับ tenant นี้`
                  : `Super Admin has blocked ${blockedCount} menu${blockedCount > 1 ? 's' : ''} for this tenant`}
              </p>
              <p className="text-xs text-amber-800/80">
                {th
                  ? 'รายการด้านล่างแสดงเฉพาะ menu ที่ tenant นี้ได้รับสิทธิ์ — ไม่สามารถเปิด menu ที่ถูกปิดเองได้ ติดต่อ Super Admin หากต้องการเพิ่มสิทธิ์'
                  : 'The list below only shows menus this tenant has access to. You cannot grant blocked menus yourself — contact your Super Admin to request access.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
