import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { STATUS_LABELS } from '@/components/ui/status-badge';

interface MetricValuePayload {
  value_id: string;
  metric_id: string;
  site_id: string;
  period_id: string;
  value: number;
  status: string;
  submitted_by: string | null;
  rejection_reason?: string | null;
}

const MANAGER_ROLES = ['admin', 'supervisor_global', 'supervisor_local', 'executive'];

export function useRealtimeNotifications() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const { addNotification } = useNotifications();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || !role) return;

    const isManager = MANAGER_ROLES.includes(role);
    // Staff only get told about their own rows (approve / reject outcome).
    // Managers get the full activity feed as before.
    if (!isManager && role !== 'staff') return;

    const label = (s: string) =>
      STATUS_LABELS[s as keyof typeof STATUS_LABELS]?.[language] ?? s;

    const channel = supabase
      .channel('metric-value-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'metric_value' },
        (payload) => {
          if (!isManager) return;
          const newRecord = payload.new as MetricValuePayload;
          if (newRecord.submitted_by === user.id) return;

          const title = language === 'th' ? '📊 ข้อมูลใหม่' : '📊 New Data';
          const description = language === 'th'
            ? `มีการบันทึกข้อมูลใหม่ (${label(newRecord.status)})`
            : `New data entry recorded (${label(newRecord.status)})`;

          toast({ title, description });
          addNotification({ title, description, type: 'info' });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'metric_value' },
        (payload) => {
          const oldRecord = payload.old as MetricValuePayload;
          const newRecord = payload.new as MetricValuePayload;
          const isMine = newRecord.submitted_by === user.id;

          // Realtime "old" only carries the PK unless REPLICA IDENTITY FULL,
          // so treat a missing old status as "unknown" rather than "changed".
          const statusChanged = oldRecord.status !== undefined && oldRecord.status !== newRecord.status;

          // ── Staff: only approve / reject outcomes on their own rows ──
          if (!isManager) {
            if (!isMine) return;
            if (newRecord.status === 'rejected') {
              const title = language === 'th' ? '❌ ข้อมูลถูกปฏิเสธ' : '❌ Entry Rejected';
              const reason = newRecord.rejection_reason
                ? (language === 'th' ? `เหตุผล: ${newRecord.rejection_reason}` : `Reason: ${newRecord.rejection_reason}`)
                : (language === 'th' ? 'กรุณาแก้ไขและส่งใหม่' : 'Please correct and resubmit');
              toast({ title, description: reason, variant: 'destructive' });
              addNotification({ title, description: reason, type: 'error' });
            } else if (newRecord.status === 'approved' && statusChanged) {
              const title = language === 'th' ? '✅ ข้อมูลได้รับการอนุมัติ' : '✅ Entry Approved';
              const description = language === 'th' ? 'ข้อมูลของคุณถูกนำขึ้นแสดงผลแล้ว' : 'Your entry is now included in the dashboards';
              toast({ title, description });
              addNotification({ title, description, type: 'success' });
            }
            return;
          }

          // ── Managers ──
          if (statusChanged) {
            let icon = '🔄';
            let notifType: 'info' | 'success' | 'warning' | 'error' = 'info';
            if (newRecord.status === 'approved') { icon = '✅'; notifType = 'success'; }
            if (newRecord.status === 'rejected') { icon = '❌'; notifType = 'error'; }
            if (newRecord.status === 'submitted') { icon = '📤'; notifType = 'info'; }

            const title = language === 'th' ? `${icon} สถานะเปลี่ยนแปลง` : `${icon} Status Changed`;
            const description = language === 'th'
              ? `สถานะเปลี่ยนจาก "${label(oldRecord.status)}" เป็น "${label(newRecord.status)}"`
              : `Status changed from "${label(oldRecord.status)}" to "${label(newRecord.status)}"`;

            toast({ title, description, variant: newRecord.status === 'rejected' ? 'destructive' : 'default' });
            addNotification({ title, description, type: notifType });
          } else {
            const title = language === 'th' ? '📝 ข้อมูลถูกแก้ไข' : '📝 Data Updated';
            const description = language === 'th' ? 'มีการแก้ไขข้อมูลในระบบ' : 'Data has been updated in the system';
            toast({ title, description });
            addNotification({ title, description, type: 'info' });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'metric_value' },
        () => {
          if (!isManager) return;
          const title = language === 'th' ? '🗑️ ข้อมูลถูกลบ' : '🗑️ Data Deleted';
          const description = language === 'th' ? 'มีการลบข้อมูลออกจากระบบ' : 'Data has been removed from the system';
          toast({ title, description, variant: 'destructive' });
          addNotification({ title, description, type: 'error' });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user, role, language, toast, addNotification]);
}
