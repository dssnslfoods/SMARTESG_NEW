import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, statusLabel, type MetricStatus } from '@/components/ui/status-badge';
import {
  ListChecks, Clock, Inbox, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Calendar, Pencil, Plus,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface MyRow {
  value_id: string;
  metric_id: string;
  site_id: string;
  period_id: string;
  value: number;
  status: string;
  remark: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  approval_note: string | null;
  metric: { metric_name: string; unit: string | null } | null;
  site: { site_name: string } | null;
  period: { year: number; month: number; month_name: string } | null;
}

type StatusFilter = '' | MetricStatus;

export default function MyEntries() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<MyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('');
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({});

  const fetchRows = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('metric_value')
        .select(`
          value_id, metric_id, site_id, period_id, value, status, remark, created_at, updated_at,
          submitted_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, approval_note,
          metric:metric_id(metric_name, unit),
          site:site_id(site_name),
          period:period_id(year, month, month_name)
        `)
        .eq('submitted_by', user.id)
        .order('updated_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const list = (data ?? []) as unknown as MyRow[];
      setRows(list);

      // Resolve reviewer names (who approved / rejected)
      const ids = [...new Set(list.flatMap(r => [r.approved_by, r.rejected_by]).filter(Boolean))] as string[];
      const missing = ids.filter(id => !reviewerNames[id]);
      if (missing.length) {
        const { data: profs } = await supabase
          .from('app_user_profile').select('user_id, full_name').in('user_id', missing);
        if (profs) {
          setReviewerNames(prev => {
            const n = { ...prev };
            profs.forEach(p => { n[p.user_id] = p.full_name || p.user_id.slice(0, 8); });
            return n;
          });
        }
      }
    } catch (e) {
      console.error('MyEntries fetch error', e);
      toast({ variant: 'destructive', title: t('error'), description: (e as Error).message });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
    rows.forEach(r => { if (r.status in c) c[r.status as MetricStatus]++; });
    return c;
  }, [rows]);

  const periods = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => { if (r.period) m.set(r.period_id, `${r.period.month_name} ${r.period.year}`); });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const visible = useMemo(() => rows.filter(r =>
    (!filterStatus || r.status === filterStatus) &&
    (!filterPeriod || r.period_id === filterPeriod)
  ), [rows, filterStatus, filterPeriod]);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

  // Rows where the staff member has to do something next
  const needsAction = counts.rejected > 0;

  const summaryCards: { key: MetricStatus; icon: typeof Clock; bar: string; iconBg: string; iconColor: string; sub: string }[] = [
    { key: 'draft',     icon: Clock,         bar: 'from-amber-400 to-orange-500',  iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   sub: language === 'th' ? 'ยังไม่ได้ส่ง' : 'not yet submitted' },
    { key: 'submitted', icon: Inbox,         bar: 'from-blue-400 to-indigo-500',   iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    sub: language === 'th' ? 'รอหัวหน้าสาขาตรวจสอบ' : 'awaiting supervisor review' },
    { key: 'approved',  icon: CheckCircle2,  bar: 'from-emerald-400 to-green-500', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', sub: language === 'th' ? 'แสดงบน dashboard แล้ว' : 'live on dashboards' },
    { key: 'rejected',  icon: AlertTriangle, bar: 'from-red-400 to-rose-500',      iconBg: 'bg-red-100',     iconColor: 'text-red-600',     sub: language === 'th' ? 'ต้องแก้ไขและส่งใหม่' : 'fix & resubmit' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-emerald-600" />
            {t('myEntries')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'th'
              ? 'ติดตามสถานะทุกรายการที่คุณบันทึก — รออนุมัติ · อนุมัติแล้ว · ถูกปฏิเสธ'
              : 'Track every entry you recorded — pending · approved · rejected'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading} className="rounded-xl">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {language === 'th' ? 'รีเฟรช' : 'Refresh'}
          </Button>
          <Button asChild size="sm" className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
            <Link to="/data-entry"><Plus className="h-4 w-4 mr-1" />{t('dataEntry')}</Link>
          </Button>
        </div>
      </div>

      {/* Rejected call-out */}
      {needsAction && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-red-50/80 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 flex-1">
            {language === 'th'
              ? `มี ${counts.rejected} รายการถูกปฏิเสธ — เปิดดูเหตุผล แก้ไข แล้วส่งอนุมัติอีกครั้ง`
              : `${counts.rejected} ${counts.rejected === 1 ? 'entry was' : 'entries were'} rejected — read the reason, fix and resubmit`}
          </p>
          <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => setFilterStatus('rejected')}>
            {language === 'th' ? 'ดูรายการที่ถูกปฏิเสธ' : 'Show rejected'}
          </Button>
        </div>
      )}

      {/* Summary cards (click = filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(c => {
          const active = filterStatus === c.key;
          return (
            <Card
              key={c.key}
              onClick={() => setFilterStatus(active ? '' : c.key)}
              className={`glass-card relative cursor-pointer hover:scale-[1.02] transition-all duration-300 overflow-hidden group ${active ? 'ring-2 ring-emerald-400' : ''}`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.bar}`} />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-gray-600">
                  <div className={`p-1.5 ${c.iconBg} rounded-lg`}>
                    <c.icon className={`h-4 w-4 ${c.iconColor}`} />
                  </div>
                  {statusLabel(c.key, language)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-800">{counts[c.key].toLocaleString()}</p>
                <p className={`text-xs mt-1 ${c.iconColor}`}>{c.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="glass-card-solid">
        <CardContent className="grid gap-3 sm:grid-cols-2 pt-4">
          <div className="space-y-1">
            <Label className="text-xs">{language === 'th' ? 'สถานะ' : 'Status'}</Label>
            <Select value={filterStatus || '__all__'} onValueChange={v => setFilterStatus(v === '__all__' ? '' : (v as MetricStatus))}>
              <SelectTrigger className="rounded-xl bg-white/80"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                <SelectItem value="draft">{statusLabel('draft', language)}</SelectItem>
                <SelectItem value="submitted">{statusLabel('submitted', language)}</SelectItem>
                <SelectItem value="approved">{statusLabel('approved', language)}</SelectItem>
                <SelectItem value="rejected">{statusLabel('rejected', language)}</SelectItem>
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card-solid overflow-hidden">
        <CardHeader className="border-b border-gray-100 py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-emerald-600" />
            {language === 'th' ? 'รายการที่บันทึก' : 'Recorded entries'}
            <Badge variant="outline" className="ml-1 rounded-full">{visible.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> {language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 text-gray-300 mb-2" />
              {rows.length === 0
                ? (language === 'th' ? 'คุณยังไม่มีรายการที่บันทึก' : "You haven't recorded any entries yet")
                : (language === 'th' ? 'ไม่มีรายการตามตัวกรอง' : 'No entries match the filter')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead>{t('site')}</TableHead>
                    <TableHead>{language === 'th' ? 'รอบ' : 'Period'}</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">{language === 'th' ? 'ค่า' : 'Value'}</TableHead>
                    <TableHead>{language === 'th' ? 'สถานะ' : 'Status'}</TableHead>
                    <TableHead>{language === 'th' ? 'ผู้ตรวจ / เมื่อ' : 'Reviewed by / at'}</TableHead>
                    <TableHead>{language === 'th' ? 'เหตุผล / หมายเหตุ' : 'Reason / note'}</TableHead>
                    <TableHead className="text-right">{language === 'th' ? 'ดำเนินการ' : 'Action'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(r => {
                    const reviewer = r.status === 'approved' ? r.approved_by : r.status === 'rejected' ? r.rejected_by : null;
                    const reviewedAt = r.status === 'approved' ? r.approved_at : r.status === 'rejected' ? r.rejected_at : null;
                    const editable = r.status !== 'approved';
                    return (
                      <TableRow key={r.value_id} className={r.status === 'rejected' ? 'bg-red-50/40' : ''}>
                        <TableCell className="font-medium text-gray-900 whitespace-nowrap">{r.site?.site_name ?? r.site_id}</TableCell>
                        <TableCell className="text-gray-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{r.period ? `${r.period.month_name} ${r.period.year}` : r.period_id}</span>
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {r.metric?.metric_name ?? r.metric_id}
                          {r.metric?.unit && <span className="text-xs text-muted-foreground ml-1">({r.metric.unit})</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">{Number(r.value).toLocaleString()}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                          {reviewer ? (
                            <>
                              <div>{reviewerNames[reviewer] ?? (language === 'th' ? 'หัวหน้าสาขา' : 'Supervisor')}</div>
                              <div className="text-muted-foreground">{fmtDate(reviewedAt)}</div>
                            </>
                          ) : r.status === 'submitted' ? (
                            <span className="text-muted-foreground">{language === 'th' ? 'ส่งเมื่อ ' : 'sent '}{fmtDate(r.submitted_at ?? r.created_at)}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[260px]">
                          {r.status === 'rejected' && r.rejection_reason
                            ? <span className="text-red-700 whitespace-pre-wrap font-medium">{r.rejection_reason}</span>
                            : <span className="text-gray-500 whitespace-pre-wrap">{r.approval_note || r.remark || '-'}</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {editable ? (
                            <Button asChild size="sm" variant={r.status === 'rejected' ? 'destructive' : 'ghost'} className="h-8 rounded-lg">
                              <Link to={`/data-entry?edit=${encodeURIComponent(r.value_id)}`}>
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                {r.status === 'rejected'
                                  ? (language === 'th' ? 'แก้ไขและส่งใหม่' : 'Fix & resubmit')
                                  : (language === 'th' ? 'แก้ไข' : 'Edit')}
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60 italic">{language === 'th' ? 'อนุมัติแล้ว' : 'approved'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
