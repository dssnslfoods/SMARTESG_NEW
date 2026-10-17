/**
 * MaintenanceBanner — thin notice shown on every page to users who are
 * allowed through while maintenance mode is on (super admins and
 * allow-listed admins). Blocked users never reach MainLayout.
 */
import { Wrench } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMaintenance } from '@/contexts/MaintenanceContext';

export function MaintenanceBanner() {
  const { isSuperAdmin } = useAuth();
  const { language } = useLanguage();
  const m = useMaintenance();
  const th = language === 'th';

  if (!m.isEnabled) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900">
      <Wrench className="h-3.5 w-3.5" />
      <span>
        {th
          ? 'ระบบอยู่ในโหมด Maintenance — คุณเข้าใช้งานในฐานะ'
          : 'System is in maintenance mode — you are signed in as'}{' '}
        {isSuperAdmin
          ? (th ? 'Super Admin' : 'a super admin')
          : (th ? 'ผู้ดูแลที่ได้รับอนุญาต' : 'an authorized admin')}
        {m.expectedEndAt && (
          <>
            {' · '}
            {th ? 'คาดว่าเสร็จ' : 'expected end'}{' '}
            {new Date(m.expectedEndAt).toLocaleString(th ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
          </>
        )}
      </span>
    </div>
  );
}
