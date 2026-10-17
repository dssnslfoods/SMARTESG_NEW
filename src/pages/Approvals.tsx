import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { invalidateMetricValueCache } from '@/hooks/useOptimizedData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  ClipboardCheck, CheckCircle2, XCircle, RefreshCw, Loader2, MapPin, Calendar, Inbox, History, AlertTriangle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = 'pending' | 'history';

interface PendingRow {
  value_id: string;
  metric_id: string;
  site_id: string;
  period_id: string;
  value: number;
  status: string;
  data_source: string | null;
  remark: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  approval_note: string | null;
  metric: { metric_name: string; unit: string | null } | null;
  site: { site_name: string } | null;
  period: { year: number; month: number; month_name: string } | null;
}

interface ReviewResult {
  processed: number;
  errors: { value_id: string; error: string; status?: string }[];
}

export default function Approvals() {
  const { t, language } = useLanguage();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<{ site_id: string; site_name: string }[]>([]);
  const [filterSite, setFilterSite] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTargets, setRejectTargets] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [working, setWorking] = useState(false);

  // ── Sites this user may review (RPC is SECURITY DEFINER, scoped per role) ──
  useEffect(() => {
    (async () => {
      const { data: ids } = await supabase.rpc('my_reviewable_sites');
      const list = (ids as string[] | null) ?? [];
      if (list.length === 0) { setSites([]); return; }
      const { data } = await supabase
        .from('site').select('site_id, site_name').in('site_id', list).order('site_name');
      setSites(data ?? []);
    })();
  }, []);

  const reviewableIds = useMemo(() => sites.map(s => s.site_id), [sites]);

  const fetchRows = useCallback(async () => {
    if (reviewableIds.length === 0) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try {
      let q = supabase
        .from('metric_value')
        .select(`
          value_id, metric_id, site_id, period_id, value, status, data_source, remark,
          submitted_by, submitted_at, created_at, approved_at, rejected_at, rejection_reason, approval_note,
          metric:metric_id(metric_name, unit),
          site:site_id(site_name),
          period:period_id(year, month, month_name)
        `)
        .in('site_id', filterSite ? [filterSite] : reviewableIds)
        .neq('data_source', 'Auto-calculated (GHG)') // derived rows follow their inputs
        .limit(1000);

      if (tab === 'pending') {
        q = q.eq('status', 'submitted').order('submitted_at', { ascending: true, nullsFirst: true });
      } else {
        q = q.eq('status', 'approved')
             .not('approved_by', 'is', null) // skip auto-approved migration rows (approved_by is null)
             .order('approved_at', { ascending: false, nullsFirst: false });
      }
      if (filterPeriod) q = q.eq('period_id', filterPeriod);

      const { data, error } = await q;
      if (error) throw error;
      let list = (data ?? []) as unknown as PendingRow[];
      // History: also show rejected rows (they have approved_by = null). Second query keeps it simple.
      if (tab === 'history') {
        let rq = supabase
          .from('metric_value')
          .select(`
            value_id, metric_id, site_id, period_id, value, status, data_source, remark,
            submitted_by, submitted_at, created_at, approved_at, rejected_at, rejection_reason, approval_note,
            metric:metric_id(metric_name, unit), site:site_id(site_name), period:period_id(year, month, month_name)
          `)
          .eq('status', 'rejected')
          .neq('data_source', 'Auto-calculated (GHG)')
          .in('site_id', filterSite ? [filterSite] : reviewableIds)
          .order('rejected_at', { ascending: false })
          .limit(500);
        if (filterPeriod) rq = rq.eq('period_id', filterPeriod);
        const { data: rej } = await rq;
        list = [...list, ...((rej ?? []) as unknown as PendingRow[])]
          .sort((a, b) => (b.approved_at ?? b.rejected_at ?? '').localeCompare(a.approved_at ?? a.rejected_at ?? ''));
      }
      setRows(list);
      setSelected(new Set());

      // Resolve submitter names
      const ids = [...new Set(list.map(r => r.submitted_by).filter(Boolean))] as string[];
      const missing = ids.filter(id => !names[id]);
      if (missing.length) {
        const { data: profs } = await supabase
          .from('app_user_profile').select('user_id, full_name').in('user_id', missing);
        if (profs) {
          setNames(prev => {
            const n = { ...prev };
            profs.forEach(p => { n[p.user_id] = p.full_name || p.user_id.slice(0, 8); });
            return n;
          });
        }
      }
    } catch (e) {
      console.error('Approvals fetch error', e);
      toast({ variant: 'destructive', title: t('error'), description: (e as Error).message });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewableIds, filterSite, filterPeriod, tab]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const periods = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => { if (r.period) m.set(r.period_id, `${r.period.month_name} ${r.period.year}`); });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  // ── Review actions ─────────────────────────────────────────────────────────
  const runReview = async (ids: string[], action: 'approve' | 'reject', reason?: string) => {
    if (ids.length === 0) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc('review_metric_values', {
        p_value_ids: ids,
        p_action: action,
        p_reason: reason ?? null,
      });
      if (error) throw error;
      const res = data as unknown as ReviewResult;
      const failed = res.errors?.length ?? 0;

      toast({
        title: action === 'approve'
          ? (language === 'th' ? `อนุมัติแล้ว ${res.processed} รายการ` : `Approved ${res.processed} entries`)
          : (language === 'th' ? `ปฏิเสธแล้ว ${res.processed} รายการ` : `Rejected ${res.processed} entries`),
        description: failed
          ? (language === 'th' ? `${failed} รายการทำไม่สำเร็จ (ไม่มีสิทธิ์ / สถานะเปลี่ยนไปแล้ว)` : `${failed} entries skipped (no permission / status changed)`)
          : undefined,
        variant: failed ? 'destructive' : 'default',
      });
      invalidateMetricValueCache();
      fetchRows();
    } catch (e) {
      toast({ variant: 'destructive', title: t('error'), description: (e as Error).message });
    } finally {
      setWorking(false);
    }
  };

  const openReject = (ids: string[]) => {
    setRejectTargets(ids);
    setRejectReason('');
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) return;
    setRejectOpen(false);
    await runReview(rejectTargets, 'reject', rejectReason.trim());
  };

  const toggle = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected(prev => prev.size === rows.length ? new Set() : new Set(rows.map(r => r.value_id)));

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

  const noScope = !loading && reviewableIds.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-emerald-600" />
            {t('approvals')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'th'
              ? 'ตรวจสอบและอนุมัติข้อมูลที่พนักงานในสาขาที่คุณดูแลส่งเข้ามา — เฉพาะรายการที่อนุมัติแล้วจึงจะแสดงบน Dashboard'
              : 'Review entries submitted by staff at the sites you supervise — only approved entries reach the dashboards'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading} className="rounded-xl">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {language === 'th' ? 'รีเฟรช' : 'Refresh'}
        </Button>
      </div>

      {/* Scope + filters */}
      <Card className="glass-card-solid">
        <CardHeader className="pb-3">
          <CardDescription className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-4 w-4 text-emerald-600" />
            {t('reviewableSites')}:
            <span className="flex flex-wrap gap-1">
              {sites.length === 0
                ? <span className="italic">{language === 'th' ? 'ยังไม่ได้รับมอบหมายสาขา' : 'No sites assigned'}</span>
                : sites.map(s => (
                  <Badge key={s.site_id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 rounded-lg">
                    {s.site_name}
                  </Badge>
                ))}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('site')}</Label>
            <Select value={filterSite || '__all__'} onValueChange={v => setFilterSite(v === '__all__' ? '' : v)}>
              <SelectTrigger className="rounded-xl bg-white/80"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === 'th' ? 'ทุกสาขาที่ดูแล' : 'All my sites'}</SelectItem>
                {sites.map(s => <SelectItem key={s.site_id} value={s.site_id}>{s.site_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'th' ? 'รอบรายงาน' : 'Period'}</Label>
            <Select value={filterPeriod || '__all__'} onValueChange={v => setFilterPeriod(v === '__all__' ? '' : v)}>
              <SelectTrigger className="rounded-xl bg-white/80"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                {periods.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{language === 'th' ? 'มุมมอง' : 'View'}</Label>
            <div className="flex rounded-xl border border-gray-200 bg-white/80 p-1">
              <button
                onClick={() => setTab('pending')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm flex items-center justify-center gap-1.5 transition ${tab === 'pending' ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Inbox className="h-4 w-4" /> {t('pendingApproval')}
              </button>
              <button
                onClick={() => setTab('history')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm flex items-center justify-center gap-1.5 transition ${tab === 'history' ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <History className="h-4 w-4" /> {language === 'th' ? 'ประวัติ' : 'History'}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk bar */}
      {tab === 'pending' && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2">
          <span className="text-sm font-medium text-emerald-800">
            {language === 'th' ? `เลือกแล้ว ${selected.size} รายการ` : `${selected.size} selected`}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" disabled={working} onClick={() => runReview([...selected], 'approve')}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-4 w-4 mr-1" /> {t('approve')}
            </Button>
            <Button size="sm" variant="destructive" disabled={working} onClick={() => openReject([...selected])} className="rounded-xl">
              <XCircle className="h-4 w-4 mr-1" /> {t('reject')}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="glass-card-solid overflow-hidden">
        <CardHeader className="border-b border-gray-100 py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {tab === 'pending'
              ? <><Inbox className="h-4 w-4 text-amber-600" /> {t('pendingApproval')}</>
              : <><History className="h-4 w-4 text-gray-600" /> {language === 'th' ? 'ประวัติการตรวจสอบ' : 'Review history'}</>}
            <Badge variant="outline" className="ml-1 rounded-full">{rows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> {language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
            </div>
          ) : noScope ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6">
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
              <p className="font-medium text-gray-700">
                {language === 'th' ? 'บัญชีนี้ยังไม่ได้รับมอบหมายสาขาสำหรับอนุมัติข้อมูล' : 'This account has no sites assigned for approvals'}
              </p>
              <p className="text-sm mt-1">
                {language === 'th' ? 'ให้ Admin กำหนดสาขาที่ดูแลในหน้า จัดการผู้ใช้' : 'Ask an Admin to assign sites in User Management'}
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              {tab === 'pending'
                ? (language === 'th' ? 'ไม่มีรายการรออนุมัติ' : 'Nothing waiting for approval')
                : (language === 'th' ? 'ยังไม่มีประวัติ' : 'No history yet')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    {tab === 'pending' && (
                      <TableHead className="w-10">
                        <Checkbox checked={selected.size === rows.length && rows.length > 0} onCheckedChange={toggleAll} />
                      </TableHead>
                    )}
                    <TableHead>{t('site')}</TableHead>
                    <TableHead>{language === 'th' ? 'รอบ' : 'Period'}</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">{language === 'th' ? 'ค่า' : 'Value'}</TableHead>
                    <TableHead>{language === 'th' ? 'ผู้ส่ง' : 'Submitted by'}</TableHead>
                    <TableHead>{tab === 'pending' ? (language === 'th' ? 'ส่งเมื่อ' : 'Submitted at') : (language === 'th' ? 'ตรวจเมื่อ' : 'Reviewed at')}</TableHead>
                    <TableHead>{language === 'th' ? 'สถานะ' : 'Status'}</TableHead>
                    <TableHead>{language === 'th' ? 'หมายเหตุ / เหตุผล' : 'Note / Reason'}</TableHead>
                    {tab === 'pending' && <TableHead className="text-right">{language === 'th' ? 'ดำเนินการ' : 'Action'}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.value_id} className={selected.has(r.value_id) ? 'bg-emerald-50/50' : ''}>
                      {tab === 'pending' && (
                        <TableCell>
                          <Checkbox checked={selected.has(r.value_id)} onCheckedChange={() => toggle(r.value_id)} />
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-gray-900 whitespace-nowrap">{r.site?.site_name ?? r.site_id}</TableCell>
                      <TableCell className="text-gray-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{r.period ? `${r.period.month_name} ${r.period.year}` : r.period_id}</span>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {r.metric?.metric_name ?? r.metric_id}
                        {r.metric?.unit && <span className="text-xs text-muted-foreground ml-1">({r.metric.unit})</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{Number(r.value).toLocaleString()}</TableCell>
                      <TableCell className="text-gray-600 text-sm">{r.submitted_by ? (names[r.submitted_by] ?? '…') : '-'}</TableCell>
                      <TableCell className="text-gray-600 text-xs whitespace-nowrap">
                        {tab === 'pending' ? fmtDate(r.submitted_at ?? r.created_at) : fmtDate(r.approved_at ?? r.rejected_at)}
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs max-w-[240px]">
                        {r.status === 'rejected' && r.rejection_reason
                          ? <span className="text-red-700 whitespace-pre-wrap">{r.rejection_reason}</span>
                          : <span className="text-gray-500 whitespace-pre-wrap">{r.approval_note || r.remark || '-'}</span>}
                      </TableCell>
                      {tab === 'pending' && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" disabled={working}
                              onClick={() => runReview([r.value_id], 'approve')}
                              className="h-8 rounded-lg text-emerald-700 hover:bg-emerald-100">
                              <CheckCircle2 className="h-4 w-4 mr-1" /> {t('approve')}
                            </Button>
                            <Button size="sm" variant="ghost" disabled={working}
                              onClick={() => openReject([r.value_id])}
                              className="h-8 rounded-lg text-red-700 hover:bg-red-100">
                              <XCircle className="h-4 w-4 mr-1" /> {t('reject')}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog — reason is mandatory */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="glass-card-solid rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              {language === 'th' ? `ปฏิเสธ ${rejectTargets.length} รายการ` : `Reject ${rejectTargets.length} ${rejectTargets.length === 1 ? 'entry' : 'entries'}`}
            </DialogTitle>
            <DialogDescription>
              {language === 'th'
                ? 'กรุณาระบุเหตุผล — ข้อความนี้จะถูกส่งกลับไปให้พนักงานเจ้าของข้อมูลเพื่อแก้ไขและส่งใหม่'
                : 'A reason is required — it is sent back to the staff member so they can correct and resubmit.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('rejectionReason')} <span className="text-red-600">*</span></Label>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder={language === 'th' ? 'เช่น ค่าสูงผิดปกติ กรุณาตรวจสอบหน่วยและแหล่งข้อมูล' : 'e.g. Value looks unusually high — please verify the unit and source'}
              className="rounded-xl bg-white/80 resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)} className="rounded-xl">
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason.trim() || working} className="rounded-xl">
              {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
