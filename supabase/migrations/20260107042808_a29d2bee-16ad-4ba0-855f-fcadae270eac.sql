-- Fix the overly permissive audit_log INSERT policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Create a more restrictive policy - only authenticated users can insert their own audit logs
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_log 
FOR INSERT TO authenticated 
WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL);