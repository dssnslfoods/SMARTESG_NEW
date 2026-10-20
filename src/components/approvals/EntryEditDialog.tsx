/**
 * EntryEditDialog — in-place correction of a staff member's own entry from
 * the "My Entries" page (rejected → fix & resubmit, pending/draft → adjust).
 *
 * Site / period / metric are fixed (changing those is a different record —
 * use Data Entry). Only value, data source, remark and the draft/submit
 * status can change; the DB trigger clears reviewer stamps on resubmit.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/hooks/use-toast';
import { invalidateMetricValueCache } from '@/hooks/useOptimizedData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { AlertTriangle, Loader2, Pencil, Save, Send } from 'lucide-react';

export interface EditableEntry {
  value_id: string;
  site_id: string;
  metric_id: string;
  period_id: string;
  value: number;
  status: string;
  data_source?: string | null;
  remark: string | null;
  rejection_reason: string | null;
  metric: { metric_name: string; unit: string | null } | null;
  site: { site_name: string } | null;
  period: { year: number; month: number; month_name: string } | null;
}

interface Props {
  entry: EditableEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EntryEditDialog({ entry, onClose, onSaved }: Props) {
  const { t, language } = useLanguage();
  const th = language === 'th';
  const { toast } = useToast();
  const { logActivity } = useAuditLog();

  const [value, setValue] = useState<string>('');
  const [dataSource, setDataSource] = useState('');
  const [remark, setRemark] = useState('');
  const [status, setStatus] = useState<'draft' | 'submitted'>('submitted');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setValue(String(entry.value ?? ''));
    setDataSource(entry.data_source ?? '');
    setRemark(entry.remark ?? '');
    // rejected / approved rows go back through approval; drafts stay drafts
    setStatus(entry.status === 'draft' ? 'draft' : 'submitted');
  }, [entry]);

  const wasRejected = entry?.status === 'rejected';
  const wasPending = entry?.status === 'submitted';

  const save = async () => {
    if (!entry) return;
    const num = Number(value);
    if (value.trim() === '' || Number.isNaN(num)) {
      toast({ variant: 'destructive', title: t('error'), description: th ? 'กรุณากรอกค่าเป็นตัวเลข' : 'Please enter a numeric value' });
      return;
    }
    setSaving(true);
    try {
      const patch = {
        value: num,
        data_source: dataSource.trim() || null,
        remark: remark.trim() || null,
        status,
      };
      // .select() so a row skipped by RLS (0 rows) is not reported as saved
      const { data: updated, error } = await supabase.from('metric_value').update(patch).eq('value_id', entry.value_id).select('value_id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error(th ? 'ไม่มีสิทธิ์แก้ไขรายการนี้ (สาขานี้ไม่อยู่ในขอบเขตของคุณ หรือรายการถูกอนุมัติแล้ว)' : 'You are not allowed to edit this entry (outside your site scope, or already approved)');
      }

      await logActivity({
        action: 'UPDATE',
        entityType: 'metric_value',
        entityId: entry.value_id,
        beforeData: entry,
        afterData: { ...entry, ...patch },
      });
      invalidateMetricValueCache();
      toast({
        title: status === 'submitted'
          ? (th ? 'ส่งอนุมัติอีกครั้งแล้ว' : 'Resubmitted for approval')
          : (th ? 'บันทึกร่างแล้ว' : 'Draft saved'),
      });
      onSaved();
      onClose();
    } catch (e) {
      toast({ variant: 'destructive', title: t('error'), description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <DialogContent className="glass-card-solid rounded-2xl max-w-lg">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-emerald-600" />
                {wasRejected ? t('resubmit') : (th ? 'แก้ไขรายการ' : 'Edit entry')}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                <span>{entry.site?.site_name ?? entry.site_id} · {entry.period ? `${entry.period.month_name} ${entry.period.year}` : entry.period_id}</span>
                <StatusBadge status={entry.status} />
              </DialogDescription>
            </DialogHeader>

            {/* Fixed identity */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-sm">
              <div className="text-[11px] text-muted-foreground">{language === 'th' ? 'ตัวชี้วัด' : 'Metric'}</div>
              <div className="font-medium text-gray-800">
                {entry.metric?.metric_name ?? entry.metric_id}
                {entry.metric?.unit && <span className="text-xs text-muted-foreground ml-1">({entry.metric.unit})</span>}
              </div>
            </div>

            {wasRejected && (
              <div className="rounded-xl border border-red-300 bg-red-50/80 px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 text-red-800 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {th ? 'รายการนี้ถูกปฏิเสธ — แก้ไขตามเหตุผลด้านล่างแล้วส่งใหม่' : 'This entry was rejected — fix it per the reason below and resubmit'}
                </div>
                <p className="text-sm text-red-700 whitespace-pre-wrap">{entry.rejection_reason || '-'}</p>
              </div>
            )}
            {wasPending && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2 text-xs text-blue-800">
                {th ? 'รายการนี้กำลังรออนุมัติ — การแก้ไขจะยังคงสถานะรออนุมัติด้วยค่าใหม่' : 'This entry is pending approval — the edit keeps it pending with the new value'}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{th ? 'ค่า' : 'Value'} <span className="text-red-600">*</span></Label>
                <Input type="number" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} autoFocus
                  className="h-11 rounded-xl bg-white/80 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>{th ? 'สถานะ' : 'Status'}</Label>
                <Select value={status} onValueChange={v => setStatus(v as 'draft' | 'submitted')}>
                  <SelectTrigger className="h-11 rounded-xl bg-white/80"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{th ? 'ร่าง' : 'Draft'}</SelectItem>
                    <SelectItem value="submitted">{wasRejected ? t('resubmit') : (th ? 'ส่งอนุมัติ' : 'Submit for approval')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{th ? 'แหล่งข้อมูล' : 'Data source'}</Label>
              <Input value={dataSource} onChange={e => setDataSource(e.target.value)} className="h-11 rounded-xl bg-white/80"
                placeholder={th ? 'ระบุแหล่งที่มาของข้อมูล' : 'Where this figure comes from'} />
            </div>
            <div className="space-y-1.5">
              <Label>{th ? 'หมายเหตุ' : 'Remark'}</Label>
              <Textarea value={remark} onChange={e => setRemark(e.target.value)} rows={3} className="rounded-xl bg-white/80 resize-none"
                placeholder={th ? 'เช่น แก้หน่วยจาก g เป็น kg ตามที่หัวหน้าแจ้ง' : 'e.g. corrected unit from g to kg as requested'} />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">
                {th ? 'ยกเลิก' : 'Cancel'}
              </Button>
              <Button onClick={save} disabled={saving}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'submitted' ? <Send className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {status === 'submitted' ? (wasRejected ? t('resubmit') : (th ? 'บันทึกและส่งอนุมัติ' : 'Save & submit')) : (th ? 'บันทึกร่าง' : 'Save draft')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
