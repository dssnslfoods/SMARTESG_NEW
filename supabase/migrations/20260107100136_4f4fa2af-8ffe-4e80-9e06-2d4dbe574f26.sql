-- Add RLS policies for supervisor to manage user profiles and roles

-- Allow supervisors to view all profiles
CREATE POLICY "Supervisors can view all profiles" 
ON public.app_user_profile 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Allow supervisors to update all profiles
CREATE POLICY "Supervisors can update all profiles" 
ON public.app_user_profile 
FOR UPDATE 
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Allow supervisors to insert profiles
CREATE POLICY "Supervisors can insert profiles" 
ON public.app_user_profile 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

-- Allow supervisors to view all roles
CREATE POLICY "Supervisors can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Allow supervisors to insert roles
CREATE POLICY "Supervisors can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

-- Allow supervisors to update roles
CREATE POLICY "Supervisors can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'supervisor'::app_role));