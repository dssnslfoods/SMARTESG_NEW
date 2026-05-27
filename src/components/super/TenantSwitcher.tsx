import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  ChevronDown,
  Check,
  Loader2,
  Crown,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TenantOption {
  tenant_id: string;
  name: string;
  slug: string;
  plan: string;
  primary_color: string | null;
  is_active: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * Tenant switcher for super_admin only.
 *
 * Updates app_user_profile.tenant_id for the current user (super_admin
 * bypasses RLS via the "Super admins can manage all app_user_profile"
 * policy). After update, full page reload so AuthContext + every query
 * picks up the new tenant.
 */
export default function TenantSwitcher() {
  const { language } = useLanguage();
  const { user, isSuperAdmin, profile } = useAuth();
  const th = language === 'th';

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Only render for super_admin
  if (!isSuperAdmin) return null;

  // Fetch tenants when popover opens
  useEffect(() => {
    if (!open || tenants.length > 0) return;
    setLoading(true);
    supabase
      .from('tenant')
      .select('tenant_id, name, slug, plan, primary_color, is_active')
      .order('name')
      .then(({ data }) => {
        setTenants((data ?? []) as TenantOption[]);
        setLoading(false);
      });
  }, [open]);

  const currentTenantId = profile?.tenant_id ?? null;
  const currentTenant = tenants.find((t) => t.tenant_id === currentTenantId);

  const handleSwitch = async (tenantId: string) => {
    if (!user || switching || tenantId === currentTenantId) return;
    setSwitching(tenantId);
    try {
      const { error } = await supabase
        .from('app_user_profile')
        .update({ tenant_id: tenantId })
        .eq('user_id', user.id);
      if (error) throw error;
      // ── Bust sessionStorage profile cache so AuthContext fetches fresh
      // data (including the new tenant_id) instead of serving the stale
      // cached profile on the next page load. ───────────────────────────
      try { sessionStorage.removeItem(`auth_cache_${user.id}`); } catch { /* ignore */ }
      // Full reload to refresh AuthContext + every query / state
      window.location.reload();
    } catch (e: any) {
      console.error('Tenant switch error:', e);
      setSwitching(null);
    }
  };

  const filtered = tenants.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mb-3 px-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Crown className="h-3 w-3 text-amber-600" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/80">
          {th ? 'มุมมอง Tenant' : 'Viewing Tenant'}
        </span>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between gap-2 h-auto py-2 px-2.5 rounded-xl border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ backgroundColor: currentTenant?.primary_color ?? '#10b981' }}
              >
                {currentTenant?.name?.charAt(0) ?? '?'}
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {currentTenant?.name ?? (th ? '— ไม่พบ —' : '— Unknown —')}
                </span>
                {currentTenant?.plan && (
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-mono">
                    {currentTenant.plan}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-72 p-0 rounded-xl overflow-hidden"
          align="start"
          sideOffset={4}
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={th ? 'ค้นหา tenant...' : 'Search tenants...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 h-8 text-xs"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {th ? 'ไม่พบ tenant' : 'No tenants found'}
              </p>
            ) : (
              filtered.map((t) => {
                const isCurrent = t.tenant_id === currentTenantId;
                const isLoading = switching === t.tenant_id;
                return (
                  <button
                    key={t.tenant_id}
                    type="button"
                    disabled={!!switching}
                    onClick={() => handleSwitch(t.tenant_id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      isCurrent
                        ? 'bg-emerald-50'
                        : 'hover:bg-slate-50'
                    } ${switching ? 'cursor-wait' : 'cursor-pointer'}`}
                  >
                    <div
                      className="h-7 w-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: t.primary_color ?? '#10b981' }}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {t.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {t.slug}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${
                        t.plan === 'enterprise'
                          ? 'border-purple-200 text-purple-700 bg-purple-50'
                          : t.plan === 'standard'
                            ? 'border-blue-200 text-blue-700 bg-blue-50'
                            : 'border-amber-200 text-amber-700 bg-amber-50'
                      }`}
                    >
                      {t.plan}
                    </Badge>
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="px-3 py-2 border-t border-border bg-slate-50/50">
            <p className="text-[10px] text-muted-foreground leading-snug">
              <Building2 className="h-3 w-3 inline mr-1" />
              {th
                ? 'เปลี่ยน tenant จะ refresh หน้าเพื่อโหลดข้อมูลใหม่'
                : 'Switching tenant will reload the page to refresh all data'}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
