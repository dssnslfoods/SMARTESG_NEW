-- Drop the existing problematic INSERT policy
DROP POLICY IF EXISTS "Staff can insert draft values" ON public.metric_value;

-- Create a new INSERT policy that allows:
-- 1. Admin can insert any data
-- 2. Staff can insert with submitted_by = auth.uid()
CREATE POLICY "Users can insert metric values"
ON public.metric_value
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role))
  OR
  (has_role(auth.uid(), 'staff'::app_role) AND submitted_by = auth.uid() AND status IN ('draft', 'submitted'))
);