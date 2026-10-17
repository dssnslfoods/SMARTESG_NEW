/**
 * MaintenancePanel — super-admin control for platform maintenance mode.
 *
 *   • Toggle maintenance on/off (confirm dialog before enabling)
 *   • Optional TH/EN message + expected end time shown on the /maintenance page
 *   • Allow-list: pick which users (any role) may keep using the system
 *
 * All writes go through SECURITY DEFINER RPCs that re-check super-admin
 * status and write audit_log rows:
 *   set_maintenance_mode(), set_maintenance_allowed_users()
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaintenanceView } from '@/pages/Maintenance';
import { Wrench, Loader2, Search, ShieldCheck, Users, Save, Power, Eye } from 'lucide-react';

const ROLE_LABEL: Record<string, { th: string; en: string }> = {
  admin:             { th: 'ผู้ดูแลระบบ',          en: 'Admin' },
  supervisor_global: { th: 'หัวหน้างาน (ภาพรวม)',  en: 'Supervisor (Global)' },
  supervisor_local:  { th: 'หัวหน้างาน (สาขา)',    en: 'Supervisor (Local)' },
  executive:         { th: 'ผู้บริหาร',            en: 'Executive' },
  staff:             { th: 'พนักงาน',              en: 'Staff' },
  guest:             { th: 'ผู้เยี่ยมชม',          en: 'Guest' },
};
const ROLE_BADGE: Record<string, string> = {
  admin:             'bg-red-50 text-red-700 border-red-200',
  supervisor_global: 'bg-amber-50 text-amber-700 border-amber-200',
  supervisor_local:  'bg-violet-50 text-violet-700 border-violet-200',
  executive:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  staff:             'bg-blue-50 text-blue-700 border-blue-200',
  guest:             'bg-gray-50 text-gray-600 border-gray-200',
};

interface AdminCandidate {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  is_allowed: boolean;
}

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MaintenancePanel() {
  const { language } = useLanguage();
  const th = language === 'th';
  const { toast } = useToast();
  const m = useMaintenance();

  // ── Form state (settings) ──────────────────────────────────────────────────
  const [messageTh, setMessageTh] = useState('');
  const [messageEn, setMessageEn] = useState('');
  const [expectedEnd, setExpectedEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<'th' | 'en'>('th');

  // ── Allow-list state ───────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<AdminCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingList, setLoadingList] = useState(true);
  const [savingList, setSavingList] = useState(false);
  const [search, setSearch] = useState('');

  // Sync form with server status whenever it changes (e.g. via Realtime).
  useEffect(() => {
    setMessageTh(m.messageTh ?? '');
    setMessageEn(m.messageEn ?? '');
    setExpectedEnd(toLocalInput(m.expectedEndAt));
  }, [m.messageTh, m.messageEn, m.expectedEndAt]);

  const loadCandidates = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase.rpc('list_maintenance_admin_candidates');
      if (error) throw error;
      const rows = (data ?? []) as AdminCandidate[];
      setCandidates(rows);
      setSelected(new Set(rows.filter(r => r.is_allowed).map(r => r.user_id)));
    } catch (err) {
      console.error('list_maintenance_admin_candidates failed:', err);
      const e = err as { code?: string; message?: string };
      toast({ variant: 'destructive', title: th ? 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ' : 'Failed to load user list', description: [e?.code, e?.message].filter(Boolean).join(' · ') });
    } finally {
      setLoadingList(false);
    }
  }, [th, toast]);

  useEffect(() => { void loadCandidates(); }, [loadCandidates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(c =>
      (c.full_name ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.role ?? '').toLowerCase().includes(q) ||
      (c.tenant_name ?? '').toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const listDirty = useMemo(() => {
    const current = new Set(candidates.filter(c => c.is_allowed).map(c => c.user_id));
    if (current.size !== selected.size) return true;
    for (const id of selected) if (!current.has(id)) return true;
    return false;
  }, [candidates, selected]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const applyMode = async (enabled: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('set_maintenance_mode', {
        p_enabled: enabled,
        p_message_th: messageTh.trim() || null,
        p_message_en: messageEn.trim() || null,
        p_expected_end_at: expectedEnd ? new Date(expectedEnd).toISOString() : null,
      });
      if (error) throw error;
      await m.refresh();
      toast({
        title: enabled
          ? (th ? 'เปิดโหมด Maintenance แล้ว' : 'Maintenance mode enabled')
          : (th ? 'ปิดโหมด Maintenance แล้ว ผู้ใช้ทุกคนกลับมาใช้งานได้' : 'Maintenance mode disabled — all users restored'),
      });
    } catch (err) {
      console.error('set_maintenance_mode failed:', err);
      toast({ variant: 'destructive', title: th ? 'บันทึกไม่สำเร็จ' : 'Save failed', description: String((err as Error)?.message ?? err) });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  const saveAllowList = async () => {
    setSavingList(true);
    try {
      const { data, error } = await supabase.rpc('set_maintenance_allowed_users', {
        p_user_ids: Array.from(selected),
      });
      if (error) throw error;
      await Promise.all([loadCandidates(), m.refresh()]);
      toast({ title: th ? `บันทึกรายชื่อแล้ว (${data ?? 0} คน)` : `Allow-list saved (${data ?? 0} users)` });
    } catch (err) {
      console.error('set_maintenance_allowed_users failed:', err);
      const e = err as { code?: string; message?: string; details?: string; hint?: string };
      toast({
        variant: 'destructive',
        title: th ? 'บันทึกรายชื่อไม่สำเร็จ' : 'Failed to save allow-list',
        description: [e?.code, e?.message, e?.details, e?.hint].filter(Boolean).join(' · ') || String(err),
      });
    } finally {
      setSavingList(false);
    }
  };

  const toggleOne = (id: string, on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const blockedCount = Math.max(0, candidates.length - selected.size);

  return (
    <Card className={`border-2 ${m.isEnabled ? 'border-red-300 bg-red-50/40' : 'border-amber-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className={`rounded-xl p-2 shadow-sm ${m.isEnabled ? 'bg-red-500' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
              <Wrench className="h-4 w-4 text-white" />
            </div>
            {th ? 'โหมดปิดระบบเพื่อบำรุงรักษา (Maintenance)' : 'Maintenance Mode'}
            {m.isEnabled ? (
              <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">{th ? 'เปิดอยู่' : 'Active'}</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-emerald-300 text-emerald-700 bg-emerald-50">{th ? 'ปิดอยู่' : 'Off'}</Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-3">
            <Label htmlFor="maintenance-switch" className="text-sm">
              {m.isEnabled ? (th ? 'ปิดโหมด' : 'Turn off') : (th ? 'เปิดโหมด' : 'Turn on')}
            </Label>
            <Switch
              id="maintenance-switch"
              checked={m.isEnabled}
              disabled={saving || !m.loaded}
              onCheckedChange={(checked) => {
                if (checked) setConfirmOpen(true);
                else void applyMode(false);
              }}
            />
          </div>
        </div>

        {m.isEnabled && (
          <p className="text-xs text-red-700 mt-1">
            {th ? 'เปิดโดย' : 'Enabled by'} <strong>{m.enabledByName ?? '—'}</strong>
            {m.enabledAt && <> · {new Date(m.enabledAt).toLocaleString(th ? 'th-TH' : 'en-US')}</>}
            {' · '}
            {th ? `ผู้ใช้ที่ได้รับอนุญาต ${m.allowedCount} คน` : `${m.allowedCount} user(s) allowed`}
          </p>
        )}
      </CardHeader>

      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Settings ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <Power className="h-3.5 w-3.5 text-amber-600" />
            {th ? 'ข้อความแจ้งผู้ใช้' : 'Message shown to users'}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{th ? 'ข้อความ (ไทย)' : 'Message (Thai)'}</Label>
            <Textarea rows={2} value={messageTh} onChange={e => setMessageTh(e.target.value)}
              placeholder={th ? 'เช่น ระบบจะกลับมาใช้งานได้ภายใน 2 ชั่วโมง' : 'e.g. ระบบจะกลับมาใช้งานได้ภายใน 2 ชั่วโมง'} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{th ? 'ข้อความ (อังกฤษ)' : 'Message (English)'}</Label>
            <Textarea rows={2} value={messageEn} onChange={e => setMessageEn(e.target.value)}
              placeholder="e.g. We expect to be back within 2 hours." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{th ? 'คาดว่าจะแล้วเสร็จ' : 'Expected end time'}</Label>
            <Input type="datetime-local" value={expectedEnd} onChange={e => setExpectedEnd(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { setPreviewLang(th ? 'th' : 'en'); setPreviewOpen(true); }} className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              {th ? 'ดูตัวอย่างหน้า Maintenance' : 'Preview maintenance page'}
            </Button>
            {m.isEnabled && (
              <Button size="sm" variant="outline" disabled={saving} onClick={() => void applyMode(true)} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {th ? 'อัปเดตข้อความ' : 'Update message'}
              </Button>
            )}
          </div>
        </div>

        {/* ── Allow-list ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {th ? 'ผู้ใช้ที่เข้าระบบได้ระหว่าง Maintenance' : 'Users allowed during maintenance'}
              <Badge variant="secondary" className="text-[10px]">{selected.size}/{candidates.length}</Badge>
            </div>
            <Button size="sm" disabled={!listDirty || savingList} onClick={() => void saveAllowList()} className="gap-1.5">
              {savingList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {th ? 'บันทึกรายชื่อ' : 'Save list'}
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-9" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={th ? 'ค้นหาชื่อ / อีเมล / role / tenant' : 'Search name / email / role / tenant'} />
          </div>

          <ScrollArea className="h-56 rounded-md border bg-background">
            {loadingList ? (
              <div className="flex items-center justify-center h-full py-10 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {th ? 'กำลังโหลด...' : 'Loading...'}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                <Users className="h-4 w-4 mr-2" />
                {th ? 'ไม่พบผู้ใช้' : 'No users found'}
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map(c => (
                  <li key={c.user_id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                    <Checkbox
                      id={`allow-${c.user_id}`}
                      checked={selected.has(c.user_id)}
                      onCheckedChange={(v) => toggleOne(c.user_id, v === true)}
                    />
                    <label htmlFor={`allow-${c.user_id}`} className="flex-1 min-w-0 cursor-pointer">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        <span className="truncate">{c.full_name || c.email || c.user_id}</span>
                        {c.role && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${ROLE_BADGE[c.role] ?? ''}`}>
                            {ROLE_LABEL[c.role]?.[th ? 'th' : 'en'] ?? c.role}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {c.email}{c.tenant_name ? ` · ${c.tenant_name}` : ''}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          <p className="text-[11px] text-muted-foreground">
            {th
              ? 'Super Admin เข้าระบบได้เสมอ เลือกผู้ใช้ role ใดก็ได้ที่ active (เช่น staff / supervisor สำหรับทดสอบระบบ)'
              : 'Super admins always have access. Any active user can be allow-listed (e.g. staff / supervisor for testing).'}
          </p>
        </div>
      </CardContent>

      {/* ── Preview: exactly what blocked users will see ─────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm">
              {th ? 'ตัวอย่างหน้าที่ผู้ใช้จะเห็น (ยังไม่ได้เปิดโหมดจริง)' : 'What blocked users will see (mode is not enabled by this)'}
            </DialogTitle>
            <div className="flex gap-1 mr-6">
              {(['th', 'en'] as const).map(l => (
                <Button key={l} size="sm" variant={previewLang === l ? 'default' : 'outline'} className="h-7 px-2 text-xs"
                  onClick={() => setPreviewLang(l)}>{l.toUpperCase()}</Button>
              ))}
            </div>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-y-auto">
            <MaintenanceView
              th={previewLang === 'th'}
              message={(previewLang === 'th' ? messageTh : messageEn).trim() || null}
              expectedEndAt={expectedEnd ? new Date(expectedEnd).toISOString() : null}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm before enabling ───────────────────────────────────────── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{th ? 'ยืนยันการปิดระบบเพื่อ Maintenance?' : 'Enable maintenance mode?'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {th
                    ? 'ผู้ใช้ทุกคนที่ไม่ใช่ Super Admin และไม่อยู่ในรายชื่อที่อนุญาต จะถูกพาไปหน้า "ระบบอยู่ระหว่างการ Upgrade" ทันที รวมถึงผู้ที่กำลังใช้งานอยู่'
                    : 'Every user who is not a super admin or on the allow-list will be sent to the "System is being upgraded" page immediately, including users currently online.'}
                </p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  <li>{th ? `ผู้ใช้ที่อนุญาต: ${selected.size} คน` : `Allowed users: ${selected.size}`}</li>
                  <li>{th ? `ผู้ใช้ที่จะถูกบล็อก: ${blockedCount} คน` : `Blocked users: ${blockedCount}`}</li>
                </ul>
                {listDirty && (
                  <p className="text-amber-700">
                    {th ? 'คุณมีการแก้ไขรายชื่อที่ยังไม่ได้บันทึก กรุณากด "บันทึกรายชื่อ" ก่อน' : 'You have unsaved allow-list changes. Save the list first.'}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{th ? 'ยกเลิก' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => { e.preventDefault(); void applyMode(true); }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {th ? 'ปิดระบบตอนนี้' : 'Enable now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
