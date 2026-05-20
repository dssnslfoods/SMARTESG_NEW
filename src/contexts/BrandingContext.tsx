import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import {
  hexToHslString,
  tintHslString,
  darkenHslString,
} from '@/lib/colorUtils';

// The default platform brand color. Tenants using exactly this value keep
// the carefully-tuned index.css emerald theme (no override applied).
const DEFAULT_BRAND = '#10b981';

// CSS variables we re-tint per tenant
const OVERRIDDEN_VARS = [
  '--primary',
  '--ring',
  '--sidebar-primary',
  '--sidebar-ring',
  '--accent',
  '--accent-foreground',
];

interface BrandingContextType {
  tenantName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tenantId = profile?.tenant_id ?? null;

  const fetchBranding = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tenant')
        .select('name, logo_url, primary_color')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) {
        setTenantName(data.name ?? null);
        setLogoUrl((data as any).logo_url ?? null);
        setPrimaryColor((data as any).primary_color ?? null);
      }
    } catch (e) {
      console.error('Branding fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (user && tenantId) {
      fetchBranding();
    }
  }, [user, tenantId, fetchBranding]);

  // Inject / reset CSS variable overrides based on primary color
  useEffect(() => {
    const root = document.documentElement;

    const reset = () => OVERRIDDEN_VARS.forEach((v) => root.style.removeProperty(v));

    if (!primaryColor || primaryColor.toLowerCase() === DEFAULT_BRAND) {
      // Default brand → keep the original index.css theme
      reset();
      return;
    }

    const primaryHsl = hexToHslString(primaryColor);
    if (!primaryHsl) {
      reset();
      return;
    }

    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--ring', primaryHsl);
    root.style.setProperty('--sidebar-primary', primaryHsl);
    root.style.setProperty('--sidebar-ring', primaryHsl);

    const accent = tintHslString(primaryColor);
    const accentFg = darkenHslString(primaryColor);
    if (accent) root.style.setProperty('--accent', accent);
    if (accentFg) root.style.setProperty('--accent-foreground', accentFg);

    return reset;
  }, [primaryColor]);

  // Clear branding on logout
  useEffect(() => {
    if (!user) {
      setTenantName(null);
      setLogoUrl(null);
      setPrimaryColor(null);
      OVERRIDDEN_VARS.forEach((v) => document.documentElement.style.removeProperty(v));
    }
  }, [user]);

  return (
    <BrandingContext.Provider
      value={{ tenantName, logoUrl, primaryColor, loading, refresh: fetchBranding }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within a BrandingProvider');
  return ctx;
}
