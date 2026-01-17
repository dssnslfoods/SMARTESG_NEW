import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';

interface MetricValuePayload {
  value_id: string;
  metric_id: string;
  site_id: string;
  period_id: string;
  value: number;
  status: string;
  submitted_by: string | null;
}

export function useRealtimeNotifications() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const { addNotification } = useNotifications();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    // Only show notifications for admin, supervisor, executive
    if (!role || !['admin', 'supervisor', 'executive'].includes(role)) return;

    const channel = supabase
      .channel('metric-value-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'metric_value',
        },
        (payload) => {
          const newRecord = payload.new as MetricValuePayload;
          
          // Don't notify for own submissions
          if (newRecord.submitted_by === user.id) return;

          const title = language === 'th' ? '📊 ข้อมูลใหม่' : '📊 New Data';
          const description = language === 'th' 
            ? `มีการบันทึกข้อมูลใหม่ (${newRecord.status === 'draft' ? 'ร่าง' : 'ส่งแล้ว'})`
            : `New data entry recorded (${newRecord.status})`;

          toast({ title, description });
          addNotification({ title, description, type: 'info' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'metric_value',
        },
        (payload) => {
          const oldRecord = payload.old as MetricValuePayload;
          const newRecord = payload.new as MetricValuePayload;
          
          // Check if status changed
          if (oldRecord.status !== newRecord.status) {
            const statusLabels: Record<string, { th: string; en: string }> = {
              draft: { th: 'ร่าง', en: 'Draft' },
              submitted: { th: 'ส่งแล้ว', en: 'Submitted' },
              approved: { th: 'อนุมัติแล้ว', en: 'Approved' },
              rejected: { th: 'ปฏิเสธ', en: 'Rejected' },
            };

            const fromStatus = statusLabels[oldRecord.status] || { th: oldRecord.status, en: oldRecord.status };
            const toStatus = statusLabels[newRecord.status] || { th: newRecord.status, en: newRecord.status };

            let icon = '🔄';
            let notifType: 'info' | 'success' | 'warning' | 'error' = 'info';
            if (newRecord.status === 'approved') { icon = '✅'; notifType = 'success'; }
            if (newRecord.status === 'rejected') { icon = '❌'; notifType = 'error'; }
            if (newRecord.status === 'submitted') { icon = '📤'; notifType = 'info'; }

            const title = language === 'th' ? `${icon} สถานะเปลี่ยนแปลง` : `${icon} Status Changed`;
            const description = language === 'th'
              ? `สถานะเปลี่ยนจาก "${fromStatus.th}" เป็น "${toStatus.th}"`
              : `Status changed from "${fromStatus.en}" to "${toStatus.en}"`;

            toast({
              title,
              description,
              variant: newRecord.status === 'rejected' ? 'destructive' : 'default',
            });
            addNotification({ title, description, type: notifType });
          } else {
            // Value updated but status didn't change
            const title = language === 'th' ? '📝 ข้อมูลถูกแก้ไข' : '📝 Data Updated';
            const description = language === 'th' 
              ? 'มีการแก้ไขข้อมูลในระบบ'
              : 'Data has been updated in the system';

            toast({ title, description });
            addNotification({ title, description, type: 'info' });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'metric_value',
        },
        () => {
          const title = language === 'th' ? '🗑️ ข้อมูลถูกลบ' : '🗑️ Data Deleted';
          const description = language === 'th' 
            ? 'มีการลบข้อมูลออกจากระบบ'
            : 'Data has been removed from the system';

          toast({ title, description, variant: 'destructive' });
          addNotification({ title, description, type: 'error' });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, role, language, toast, addNotification]);
}
