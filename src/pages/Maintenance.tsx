/**
 * /maintenance — full-screen "system is being upgraded" page.
 *
 * Shown to any signed-in user who is blocked by maintenance mode. If the
 * mode is switched off (or the user is added to the allow-list) while this
 * page is open, the Realtime-driven context flips `accessAllowed` and we
 * redirect back to the dashboard automatically.
 *
 * <MaintenanceView> is the presentational part, reused by the super-admin
 * "Preview" dialog so they see exactly what blocked users will see.
 */
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Wrench, RefreshCcw, LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMaintenance } from '@/contexts/MaintenanceContext';

interface MaintenanceViewProps {
  th: boolean;
  message?: string | null;
  expectedEndAt?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
}

export function MaintenanceView({ th, message, expectedEndAt, onRetry, onSignOut }: MaintenanceViewProps) {
  const expectedEnd = expectedEndAt
    ? new Date(expectedEndAt).toLocaleString(th ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="min-h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 backdrop-blur shadow-xl p-8 sm:p-10 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
          <Wrench className="h-8 w-8 text-white" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {th ? 'ระบบอยู่ระหว่างการ Upgrade' : 'System is being upgraded'}
          </h1>
          <p className="text-sm text-slate-600">
            {th
              ? 'ขออภัยในความไม่สะดวก ระบบกำลังปรับปรุงเพื่อให้บริการที่ดียิ่งขึ้น กรุณาลองใหม่ภายหลัง'
              : 'Sorry for the inconvenience. We are performing scheduled maintenance. Please try again later.'}
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 whitespace-pre-line">
            {message}
          </div>
        )}

        {expectedEnd && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span>{th ? 'คาดว่าจะแล้วเสร็จ' : 'Expected to finish'}: <strong className="text-slate-800">{expectedEnd}</strong></span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            {th ? 'ลองอีกครั้ง' : 'Try again'}
          </Button>
          <Button variant="ghost" className="gap-2 text-slate-600" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            {th ? 'ออกจากระบบ' : 'Sign out'}
          </Button>
        </div>

        <p className="text-[11px] text-slate-400">
          {th ? 'หน้านี้จะกลับสู่ระบบโดยอัตโนมัติเมื่อการ Upgrade เสร็จสิ้น' : 'This page will return you to the app automatically once maintenance ends.'}
        </p>
      </div>
    </div>
  );
}

export default function Maintenance() {
  const { user, loading, signOut } = useAuth();
  const { language } = useLanguage();
  const m = useMaintenance();
  const navigate = useNavigate();
  const th = language === 'th';

  if (loading || !m.loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!m.isEnabled || m.accessAllowed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen">
      <MaintenanceView
        th={th}
        message={th ? m.messageTh : m.messageEn}
        expectedEndAt={m.expectedEndAt}
        onRetry={() => void m.refresh()}
        onSignOut={async () => { await signOut(); navigate('/auth', { replace: true }); }}
      />
    </div>
  );
}
