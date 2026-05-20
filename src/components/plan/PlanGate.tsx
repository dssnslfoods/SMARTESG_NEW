/**
 * PlanGate — wraps a UI section that requires a specific plan feature.
 * If the tenant's plan doesn't include the feature, renders a locked overlay.
 */
import { Lock } from 'lucide-react';
import { ReactNode } from 'react';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlanGateProps {
  feature: 'export' | 'audit_log' | 'whitelabel';
  children: ReactNode;
  /** When true, renders nothing instead of a locked card */
  hideWhenLocked?: boolean;
}

export function PlanGate({ feature, children, hideWhenLocked = false }: PlanGateProps) {
  const { isSuperAdmin } = useAuth();
  const { limits, loading } = usePlanLimits();
  const { language } = useLanguage();
  const th = language === 'th';

  if (loading) return <>{children}</>;
  if (isSuperAdmin) return <>{children}</>;

  const allowed = (() => {
    if (!limits) return false;
    if (feature === 'export')    return limits.allow_export;
    if (feature === 'audit_log') return limits.allow_audit_log;
    if (feature === 'whitelabel') return limits.allow_whitelabel;
    return false;
  })();

  if (allowed) return <>{children}</>;
  if (hideWhenLocked) return null;

  const featureLabel: Record<typeof feature, { th: string; en: string }> = {
    export:     { th: 'ส่งออกรายงาน (Export)',     en: 'Report Export' },
    audit_log:  { th: 'Audit Log',                   en: 'Audit Log' },
    whitelabel: { th: 'White-label (โลโก้ / สี)',     en: 'White-label Branding' },
  };

  const planLabel: Record<string, { th: string; en: string }> = {
    trial:    { th: 'Trial',      en: 'Trial' },
    standard: { th: 'Standard',   en: 'Standard' },
  };

  const currentPlan = limits?.plan ?? 'trial';
  const requiredPlan = feature === 'whitelabel' ? 'standard' : 'standard';

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="pointer-events-none select-none opacity-30">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[2px]">
        <div className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 shadow-md">
          <Lock className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {th
              ? `${featureLabel[feature].th} ต้องการแพ็กเกจ ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} ขึ้นไป`
              : `${featureLabel[feature].en} requires ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher`}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {th
            ? `แพ็กเกจปัจจุบัน: ${planLabel[currentPlan]?.th ?? currentPlan}`
            : `Current plan: ${planLabel[currentPlan]?.en ?? currentPlan}`}
        </p>
      </div>
    </div>
  );
}
