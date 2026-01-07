-- Fix RLS policies: change from RESTRICTIVE to PERMISSIVE
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Create permissive policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles 
FOR SELECT TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles 
FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles 
FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles 
FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles 
FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Fix app_user_profile policies too
DROP POLICY IF EXISTS "Users can view own profile" ON public.app_user_profile;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.app_user_profile;
DROP POLICY IF EXISTS "Users can update own profile" ON public.app_user_profile;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.app_user_profile;

CREATE POLICY "Users can view own profile" ON public.app_user_profile 
FOR SELECT TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.app_user_profile 
FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.app_user_profile 
FOR UPDATE TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Admins can insert profiles" ON public.app_user_profile 
FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" ON public.app_user_profile 
FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles" ON public.app_user_profile 
FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));