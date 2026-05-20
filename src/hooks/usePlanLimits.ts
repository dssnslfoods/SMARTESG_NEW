import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PlanLimits {
  plan: 'trial' | 'standard' | 'enterprise';
  max_users: number;        // -1 = unlimited
  max_sites: number;
  max_companies: number;
  max_metrics: number;
  allow_whitelabel: boolean;
  allow_export: boolean;
  allow_audit_log: boolean;
  trial_ends_at: string | null;
  is_trial_expired: boolean;
}

const UNLIMITED = -1;

export function usePlanLimits() {
  const { user, isSuperAdmin } = useAuth();

  const { data, isLoading } = useQuery<PlanLimits | null>({
    queryKey: ['plan-limits', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tenant_plan_limits');
      if (error) {
        console.error('usePlanLimits error:', error);
        return null;
      }
      return (data as PlanLimits[])?.[0] ?? null;
    },
  });

  /** Returns true when the limit is reached or exceeded */
  function isAtLimit(resource: 'users' | 'sites' | 'companies' | 'metrics', currentCount: number): boolean {
    if (!data) return false;
    if (isSuperAdmin) return false; // super admin bypasses all limits

    const limitMap: Record<typeof resource, number> = {
      users:     data.max_users,
      sites:     data.max_sites,
      companies: data.max_companies,
      metrics:   data.max_metrics,
    };

    const limit = limitMap[resource];
    if (limit === UNLIMITED) return false;
    return currentCount >= limit;
  }

  /** Returns remaining quota (-1 = unlimited) */
  function remaining(resource: 'users' | 'sites' | 'companies' | 'metrics', currentCount: number): number {
    if (!data) return UNLIMITED;
    if (isSuperAdmin) return UNLIMITED;

    const limitMap: Record<typeof resource, number> = {
      users:     data.max_users,
      sites:     data.max_sites,
      companies: data.max_companies,
      metrics:   data.max_metrics,
    };

    const limit = limitMap[resource];
    if (limit === UNLIMITED) return UNLIMITED;
    return Math.max(0, limit - currentCount);
  }

  /** Trial days remaining (null if not trial) */
  const trialDaysLeft: number | null = (() => {
    if (!data || data.plan !== 'trial' || !data.trial_ends_at) return null;
    const diff = new Date(data.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  return {
    limits: data ?? null,
    loading: isLoading,
    isAtLimit,
    remaining,
    trialDaysLeft,
    isTrial: data?.plan === 'trial',
    isTrialExpired: data?.is_trial_expired ?? false,
    canExport: isSuperAdmin || (data?.allow_export ?? false),
    canAuditLog: isSuperAdmin || (data?.allow_audit_log ?? false),
    canWhitelabel: isSuperAdmin || (data?.allow_whitelabel ?? false),
  };
}
