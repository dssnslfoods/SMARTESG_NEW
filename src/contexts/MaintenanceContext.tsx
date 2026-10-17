/**
 * MaintenanceContext — platform-wide maintenance mode state.
 *
 * Loads `get_maintenance_status()` once the auth user is known and keeps it
 * fresh through Supabase Realtime on `system_maintenance` and
 * `maintenance_allowed_user`, so sessions that are already open get kicked to
 * (or released from) the /maintenance page without a refresh.
 *
 * `accessAllowed` is computed server-side: super admins always pass, admins
 * on the allow-list pass, everyone else is blocked while `isEnabled` is true.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MaintenanceStatus {
  isEnabled: boolean;
  messageTh: string | null;
  messageEn: string | null;
  expectedEndAt: string | null;
  enabledAt: string | null;
  enabledByName: string | null;
  allowedCount: number;
  accessAllowed: boolean;
}

interface MaintenanceContextType extends MaintenanceStatus {
  loaded: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_STATUS: MaintenanceStatus = {
  isEnabled: false,
  messageTh: null,
  messageEn: null,
  expectedEndAt: null,
  enabledAt: null,
  enabledByName: null,
  allowedCount: 0,
  accessAllowed: true,
};

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export function parseMaintenanceStatus(raw: unknown): MaintenanceStatus {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    isEnabled: Boolean(r.is_enabled),
    messageTh: (r.message_th as string | null) ?? null,
    messageEn: (r.message_en as string | null) ?? null,
    expectedEndAt: (r.expected_end_at as string | null) ?? null,
    enabledAt: (r.enabled_at as string | null) ?? null,
    enabledByName: (r.enabled_by_name as string | null) ?? null,
    allowedCount: Number(r.allowed_count ?? 0),
    // Fail open only when the server says so; a missing key means blocked
    // if maintenance is on, which is the safe default.
    accessAllowed: r.access_allowed === undefined ? !r.is_enabled : Boolean(r.access_allowed),
  };
}

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const { user, roleLoaded } = useAuth();
  const [status, setStatus] = useState<MaintenanceStatus>(DEFAULT_STATUS);
  const [loaded, setLoaded] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_maintenance_status');
      if (error) throw error;
      setStatus(parseMaintenanceStatus(data));
    } catch (err) {
      console.error('Failed to load maintenance status:', err);
      // Keep the previous status; never lock the app out on a transient error.
    } finally {
      setLoaded(true);
    }
  }, []);

  // Initial load + reload whenever the signed-in user (and therefore the
  // allow-list verdict) changes.
  useEffect(() => {
    void refresh();
  }, [refresh, user?.id, roleLoaded]);

  // Realtime: any change to the flag or allow-list → re-evaluate.
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase
      .channel('system-maintenance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_maintenance' }, () => {
        void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_allowed_user' }, () => {
        void refresh();
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [refresh, user?.id]);

  return (
    <MaintenanceContext.Provider value={{ ...status, loaded, refresh }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error('useMaintenance must be used within a MaintenanceProvider');
  return ctx;
}
