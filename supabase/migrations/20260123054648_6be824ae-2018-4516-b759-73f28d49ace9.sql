-- =============================================
-- Update RLS policies for metric_value table
-- Staff: can VIEW all records from their site, but can only UPDATE/DELETE their own
-- Supervisor: can manage all records
-- =============================================

-- Drop existing staff view policy (currently only sees own submissions)
DROP POLICY IF EXISTS "Staff can view own submissions" ON public.metric_value;

-- Create new policy: Staff can view all records from their assigned site
CREATE POLICY "Staff can view records from their site"
ON public.metric_value
FOR SELECT
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  AND site_id = get_user_site(auth.uid())
);

-- Note: The following policies already exist and are correct:
-- "Staff can update own data" - UPDATE - (has_role(auth.uid(), 'staff') AND submitted_by = auth.uid())
-- "Staff can delete own data" - DELETE - (has_role(auth.uid(), 'staff') AND submitted_by = auth.uid())
-- "Supervisors can view all values" - SELECT
-- "Supervisors can update all metric values" - UPDATE
-- "Supervisors can delete all metric values" - DELETE