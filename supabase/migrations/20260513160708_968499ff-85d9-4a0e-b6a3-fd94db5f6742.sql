
-- 1. Explicit deny for anonymous access on app_user_profile (defense in depth)
CREATE POLICY "Deny anonymous access to profiles"
ON public.app_user_profile
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2. Remove permissive insert policy on audit_log; the create_audit_log() SECURITY DEFINER function
--    handles inserts on behalf of users, so application code does not need direct INSERT access.
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;

-- Add restrictive deny for anon on audit_log too
CREATE POLICY "Deny anonymous access to audit log"
ON public.audit_log
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
