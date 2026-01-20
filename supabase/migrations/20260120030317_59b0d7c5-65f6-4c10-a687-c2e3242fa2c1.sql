-- Allow supervisors to update metric_value status (and other editable fields) across all records

DROP POLICY IF EXISTS "Supervisors can approve/reject" ON public.metric_value;

CREATE POLICY "Supervisors can update all metric values"
ON public.metric_value
FOR UPDATE
USING (has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));