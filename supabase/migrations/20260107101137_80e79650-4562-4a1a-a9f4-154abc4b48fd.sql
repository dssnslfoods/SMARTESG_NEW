-- Drop existing staff policies that need to be updated
DROP POLICY IF EXISTS "Staff can update own drafts" ON public.metric_value;

-- Create new policy: Staff can update their own data (any status)
CREATE POLICY "Staff can update own data" 
ON public.metric_value 
FOR UPDATE 
USING (has_role(auth.uid(), 'staff'::app_role) AND submitted_by = auth.uid());

-- Create policy: Staff can delete their own data
CREATE POLICY "Staff can delete own data" 
ON public.metric_value 
FOR DELETE 
USING (has_role(auth.uid(), 'staff'::app_role) AND submitted_by = auth.uid());