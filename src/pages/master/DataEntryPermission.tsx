import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Lock, Loader2, ShieldCheck, RotateCcw } from 'lucide-react';
import { NON_ADMIN_ROLES, type AppRole } from '@/lib/menuConfig';

// ─── Permission model ─────────────────────────────────────────────────────────
type CreateScope = 'all' | 'own_company' | 'own_site';
type EditScope = 'none' | 'own' | 'all';
interface RolePerm {
  can_create: boolean;
  create_scope: CreateScope;
  edit_scope: EditScope;
  delete_scope: EditScope;
}
type PermState = Record<string, RolePerm>;

// Defaults mirror the app's historical behaviour (used as a fallback if a role
// row hasn't been seeded yet). Admin is always full and is not stored here.
export const DEFAULT_DATA_ENTRY_PERMS: Record<string, RolePerm> = {
  supervisor: { can_create: true,  create_scope: 'all',      edit_scope: 'all',  delete_scope: 'all'  },
  executive:  { can_create: false, create_scope: 'all',      edit_scope: 'none', delete_scope: 'none' },
  staff:      { can_create: true,  create_scope: 'own_site', edit_scope: 'own',  delete_scope: 'own'  },
  guest:      { can_create: false, create_scope: 'all',      edit_scope: 'none', delete_scope: 'none' },
};

const ROLE_LABELS: Record<AppRole, { en: string; th: string; color: string }> = {
  admin:      { en: 'Admin',      th: 'ผู้ดูแล',      color: 'bg-red-100 text-red-700 border-red-200' },
  supervisor: { en: 'Supervisor', th: 'หัวหน้างาน',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  executive:  { en: 'Executive',  th: 'ผู้บริหาร',     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  staff:      { en: 'Staff',      th: 'พนักงาน',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  guest:      { en: 'Guest',      th: 'ผู้เยี่ยมชม',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
  super_admin:{ en: 'Super Admin',th: 'ซูเปอร์แอดมิน', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

export default function DataEntryPermission() {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const { toast } = useToast();
  const th = language === 'th';
  const tenantId = profile?.tenant_id ?? null;

  const [perms, setPerms] = useState<PermState>({});
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const createScopeOptions: { value: CreateScope; en: string; th: string }[] = [
    { value: 'all',         en: 'Any company / site',    th: 'ทุกบริษัท / สถานที่' },
    { value: 'own_company', en: 'Own company only',      th: 'เฉพาะบริษัทที่สังกัด' },
    { value: 'own_site',    en: 'Own site only',         th: 'เฉพาะสถานที่ที่สังกัด' },
  ];
  const editScopeOptions: { value: EditScope; en: string; th: string }[] = [
    { value: 'all',  en: 'All records',  th: 'ทุกรายการ' },
    { value: 'own',  en: 'Own only',     th: 'เฉพาะที่ตนสร้าง' },
    { value: 'none', en: 'Not allowed',  th: 'ไม่อนุญาต' },
  ];

  // ── Load (merge DB rows over defaults) ──────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_entry_permission')
        .select('role, can_create, create_scope, edit_scope, delete_scope');
      if (error) throw error;
      const byRole = new Map((data ?? []).map((r: any) => [r.role, r]));
      const next: PermState = {};
      NON_ADMIN_ROLES.forEach((role) => {
        const row = byRole.get(role);
        next[role] = row
          ? {
              can_create: !!row.can_create,
              create_scope: row.create_scope,
              edit_scope: row.edit_scope,
              delete_scope: row.delete_scope,
            }
          : { ...DEFAULT_DATA_ENTRY_PERMS[role] };
      });
      setPerms(next);
    } catch (e: any) {
      toast({ variant: 'destructive', title: th ? 'ข้อผิดพลาด' : 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // ── Persist one role row ────────────────────────────────────────────────────
  const saveRole = async (role: string, patch: Partial<RolePerm>) => {
    if (!tenantId) return;
    const prev = perms[role];
    const merged = { ...prev, ...patch };
    setPerms((p) => ({ ...p, [role]: merged }));
    setSavingRole(role);
    try {
      const { error } = await supabase.from('data_entry_permission').upsert(
        {
          tenant_id: tenantId,
          role,
          can_create: merged.can_create,
          create_scope: merged.create_scope,
          edit_scope: merged.edit_scope,
          delete_scope: merged.delete_scope,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,role' },
      );
      if (error) throw error;
    } catch (e: any) {
      setPerms((p) => ({ ...p, [role]: prev })); // revert
      toast({ variant: 'destructive', title: th ? 'ข้อผิดพลาด' : 'Error', description: e.message });
    } finally {
      setSavingRole(null);
    }
  };

  // ── Reset all roles to defaults (this tenant only) ──────────────────────────
  const handleReset = async () => {
    if (!tenantId) return;
    setResetting(true);
    try {
      const rows = NON_ADMIN_ROLES.map((role) => ({
        tenant_id: tenantId,
        role,
        ...DEFAULT_DATA_ENTRY_PERMS[role],
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from('data_entry_permission')
        .upsert(rows, { onConflict: 'tenant_id,role' });
      if (error) throw error;
      const next: PermState = {};
      NON_ADMIN_ROLES.forEach((role) => { next[role] = { ...DEFAULT_DATA_ENTRY_PERMS[role] }; });
      setPerms(next);
      toast({ title: th ? 'คืนค่าสำเร็จ' : 'Reset complete' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: th ? 'ข้อผิดพลาด' : 'Error', description: e.message });
    } finally {
      setResetting(false);
    }
  };

  const enabledCount = useMemo(
    () => NON_ADMIN_ROLES.filter((r) => perms[r]?.can_create).length,
    [perms],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            {th ? 'สิทธิ์การบันทึกข้อมูล' : 'Data Entry Permissions'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {th
              ? 'กำหนดว่าแต่ละ Role ทำอะไรได้บ้างในหน้า Data Entry — สร้าง / ขอบเขตบริษัท-สถานที่ / แก้ไข / ลบ (เฉพาะ tenant ของคุณ)'
              : 'Control what each role can do in Data Entry — create, company/site scope, edit, and delete (your tenant only).'}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={resetting || loading} className="gap-1.5 shrink-0">
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {th ? 'คืนค่าเริ่มต้น' : 'Reset to Defaults'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{th ? 'คืนค่าสิทธิ์เป็นค่าเริ่มต้น?' : 'Reset to defaults?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {th
                  ? 'สิทธิ์การบันทึกข้อมูลทุก Role ของ tenant นี้จะถูกตั้งกลับเป็นค่าเริ่มต้น มีผลเฉพาะ tenant ของคุณ'
                  : 'All roles’ data-entry permissions for this tenant will revert to defaults. Affects only your tenant.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{th ? 'ยกเลิก' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>{th ? 'คืนค่า' : 'Reset'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Notice + stat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="glass-card-solid sm:col-span-2">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-foreground mb-0.5">
                  {th ? 'Admin บันทึก/แก้ไข/ลบได้ทุกอย่างเสมอ' : 'Admin always has full data-entry access'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {th
                    ? '“เฉพาะที่สังกัด” อ้างอิงบริษัท/สถานที่ในโปรไฟล์ของผู้ใช้ · “เฉพาะที่ตนสร้าง” = แก้/ลบได้เฉพาะรายการที่ผู้ใช้คนนั้นบันทึกเอง'
                    : '“Own” scopes use the company/site on the user’s profile · “Own only” edit/delete = only records that user created.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card-solid">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{enabledCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {th ? `Role ที่สร้างข้อมูลได้ / ${NON_ADMIN_ROLES.length}` : `Roles that can create / ${NON_ADMIN_ROLES.length}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Matrix */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card className="glass-card-solid">
          <CardContent className="pt-4 px-0 pb-2 overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-border/50 text-xs font-semibold text-muted-foreground">
                  <th className="text-left px-4 pb-3 w-40">{th ? 'บทบาท' : 'Role'}</th>
                  <th className="px-3 pb-3 text-center w-28">{th ? 'สร้างข้อมูล' : 'Can Create'}</th>
                  <th className="px-3 pb-3 text-center">{th ? 'ขอบเขตการสร้าง' : 'Create Scope'}</th>
                  <th className="px-3 pb-3 text-center">{th ? 'การแก้ไข' : 'Edit'}</th>
                  <th className="px-3 pb-3 text-center">{th ? 'การลบ' : 'Delete'}</th>
                </tr>
              </thead>
              <tbody>
                {/* Admin — locked full */}
                <tr className="border-b border-border/30 bg-muted/10">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs gap-1 ${ROLE_LABELS.admin.color}`}>
                      <Lock className="h-3 w-3" />{th ? ROLE_LABELS.admin.th : ROLE_LABELS.admin.en}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-center"><Lock className="h-3.5 w-3.5 text-red-400 mx-auto" /></td>
                  <td className="px-3 py-3 text-center text-xs text-muted-foreground">{th ? 'ทั้งหมด' : 'All'}</td>
                  <td className="px-3 py-3 text-center text-xs text-muted-foreground">{th ? 'ทุกรายการ' : 'All records'}</td>
                  <td className="px-3 py-3 text-center text-xs text-muted-foreground">{th ? 'ทุกรายการ' : 'All records'}</td>
                </tr>

                {NON_ADMIN_ROLES.map((role) => {
                  const p = perms[role];
                  if (!p) return null;
                  const busy = savingRole === role;
                  return (
                    <tr key={role} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${ROLE_LABELS[role].color}`}>
                          {th ? ROLE_LABELS[role].th : ROLE_LABELS[role].en}
                        </Badge>
                      </td>
                      {/* Can create */}
                      <td className="px-3 py-3 text-center">
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                        ) : (
                          <Switch
                            checked={p.can_create}
                            onCheckedChange={(v) => saveRole(role, { can_create: v })}
                            className="mx-auto data-[state=checked]:bg-emerald-600"
                          />
                        )}
                      </td>
                      {/* Create scope */}
                      <td className="px-3 py-3">
                        <Select
                          value={p.create_scope}
                          onValueChange={(v) => saveRole(role, { create_scope: v as CreateScope })}
                          disabled={!p.can_create}
                        >
                          <SelectTrigger className="h-9 text-xs bg-white rounded-lg disabled:opacity-50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {createScopeOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{th ? o.th : o.en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* Edit */}
                      <td className="px-3 py-3">
                        <Select value={p.edit_scope} onValueChange={(v) => saveRole(role, { edit_scope: v as EditScope })}>
                          <SelectTrigger className="h-9 text-xs bg-white rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {editScopeOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{th ? o.th : o.en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* Delete */}
                      <td className="px-3 py-3">
                        <Select value={p.delete_scope} onValueChange={(v) => saveRole(role, { delete_scope: v as EditScope })}>
                          <SelectTrigger className="h-9 text-xs bg-white rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {editScopeOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{th ? o.th : o.en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center pb-2">
        {th
          ? '💡 การเปลี่ยนแปลงมีผลทันที — ผู้ใช้จะเห็นผลหลัง refresh หน้า Data Entry'
          : '💡 Changes apply immediately. Users will see the effect after refreshing the Data Entry page.'}
      </p>
    </div>
  );
}
