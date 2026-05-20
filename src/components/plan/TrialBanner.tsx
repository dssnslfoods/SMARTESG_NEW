import { AlertTriangle, Lock, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function TrialBanner() {
  const { isSuperAdmin } = useAuth();
  const { isTrial, isTrialExpired, trialDaysLeft, loading } = usePlanLimits();
  const { language } = useLanguage();
  const th = language === 'th';

  // Super admin and non-trial tenants see nothing
  if (loading || isSuperAdmin || !isTrial) return null;

  if (isTrialExpired) {
    return (
      <Alert className="rounded-none border-x-0 border-t-0 border-red-400 bg-red-50 py-2">
        <Lock className="h-4 w-4 text-red-600" />
        <AlertDescription className="flex items-center justify-between text-sm text-red-700">
          <span>
            {th
              ? 'Trial ของคุณหมดอายุแล้ว — ระบบถูกล็อก กรุณาติดต่อทีมงานเพื่ออัพเกรดแพ็กเกจ'
              : 'Your trial has expired — system is locked. Please contact us to upgrade your plan.'}
          </span>
          <Button size="sm" variant="destructive" className="ml-4 h-7 shrink-0"
            onClick={() => window.open('mailto:contact@d2infinite.com?subject=Upgrade Plan', '_blank')}>
            {th ? 'ติดต่ออัพเกรด' : 'Contact Us'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (trialDaysLeft !== null && trialDaysLeft <= 7) {
    return (
      <Alert className="rounded-none border-x-0 border-t-0 border-amber-400 bg-amber-50 py-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="flex items-center justify-between text-sm text-amber-800">
          <span>
            {th
              ? `Trial จะหมดอายุใน ${trialDaysLeft} วัน — อัพเกรดเพื่อใช้งานต่อเนื่อง`
              : `Trial expires in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} — upgrade to continue.`}
          </span>
          <Button size="sm" variant="outline" className="ml-4 h-7 shrink-0 border-amber-500 text-amber-700 hover:bg-amber-100"
            onClick={() => window.open('mailto:contact@d2infinite.com?subject=Upgrade Plan', '_blank')}>
            <Zap className="mr-1 h-3 w-3" />
            {th ? 'อัพเกรด' : 'Upgrade'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Trial still has > 7 days — show subtle notice
  if (trialDaysLeft !== null) {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-1.5 text-xs text-blue-700">
        <Zap className="h-3 w-3" />
        {th
          ? `คุณกำลังใช้งาน Trial Plan — เหลืออีก ${trialDaysLeft} วัน`
          : `You are on Trial Plan — ${trialDaysLeft} days remaining`}
      </div>
    );
  }

  return null;
}
