-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can insert metric values" ON public.metric_value;

-- Create updated INSERT policy that includes supervisor role
CREATE POLICY "Users can insert metric values"
ON public.metric_value
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role))
  OR
  (has_role(auth.uid(), 'supervisor'::app_role))
  OR
  (has_role(auth.uid(), 'staff'::app_role) AND submitted_by = auth.uid() AND status IN ('draft', 'submitted'))
);