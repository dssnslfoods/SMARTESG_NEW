import { supabase } from "@/integrations/supabase/client";

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SUBMIT';

interface AuditLogParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  beforeData?: unknown;
  afterData?: unknown;
}

export const useAuditLog = () => {
  const logActivity = async ({
    action,
    entityType,
    entityId,
    beforeData,
    afterData,
  }: AuditLogParams): Promise<void> => {
    try {
      await supabase.rpc('create_audit_log', {
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId || null,
        p_before: beforeData ? JSON.parse(JSON.stringify(beforeData)) : null,
        p_after: afterData ? JSON.parse(JSON.stringify(afterData)) : null,
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  };

  return { logActivity };
};
