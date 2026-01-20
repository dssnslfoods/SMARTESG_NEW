-- Drop the scoped supervisor SELECT policy
DROP POLICY IF EXISTS "Supervisors can view scoped values" ON public.metric_value;

-- Create new policy: Supervisors can view ALL metric values
CREATE POLICY "Supervisors can view all values"
ON public.metric_value
FOR SELECT
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Add DELETE policy for supervisors
CREATE POLICY "Supervisors can delete all metric values"
ON public.metric_value
FOR DELETE
USING (has_role(auth.uid(), 'supervisor'::app_role));