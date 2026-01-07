-- ESG Smart Performance v1.0 Database Schema

-- 1. Create role enum type
CREATE TYPE public.app_role AS ENUM ('admin', 'executive', 'supervisor', 'staff');

-- 2. Company table (master)
CREATE TABLE public.company (
    company_id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    industry TEXT NULL,
    country TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Site table (master)
CREATE TABLE public.site (
    site_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES public.company(company_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    site_name TEXT NOT NULL,
    location TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Reporting Period table (master)
CREATE TABLE public.reporting_period (
    period_id TEXT PRIMARY KEY,
    year INT NOT NULL,
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    month_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ESG Dimension table (master)
CREATE TABLE public.esg_dimension (
    dimension_id TEXT PRIMARY KEY,
    dimension_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ESG Theme table (master)
CREATE TABLE public.esg_theme (
    theme_id TEXT PRIMARY KEY,
    dimension_id TEXT NOT NULL REFERENCES public.esg_dimension(dimension_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    theme_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ESG Metric table (master)
CREATE TABLE public.esg_metric (
    metric_id TEXT PRIMARY KEY,
    theme_id TEXT NOT NULL REFERENCES public.esg_theme(theme_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    metric_name TEXT NOT NULL,
    unit TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Metric Value table (fact table)
CREATE TABLE public.metric_value (
    value_id TEXT PRIMARY KEY,
    metric_id TEXT NOT NULL REFERENCES public.esg_metric(metric_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    site_id TEXT NOT NULL REFERENCES public.site(site_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    period_id TEXT NOT NULL REFERENCES public.reporting_period(period_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    value NUMERIC(18,2) NOT NULL,
    data_source TEXT NULL,
    last_updated TIMESTAMPTZ NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    submitted_by UUID NULL REFERENCES auth.users(id),
    approved_by UUID NULL REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NULL,
    remark TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (metric_id, site_id, period_id)
);

-- 9. User Roles table (separate from profile for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- 10. App User Profile table
CREATE TABLE public.app_user_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NULL,
    company_id TEXT NULL REFERENCES public.company(company_id),
    site_id TEXT NULL REFERENCES public.site(site_id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Audit Log table
CREATE TABLE public.audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NULL,
    before_data JSONB NULL,
    after_data JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_site_company ON public.site(company_id);
CREATE INDEX idx_theme_dimension ON public.esg_theme(dimension_id);
CREATE INDEX idx_metric_theme ON public.esg_metric(theme_id);
CREATE INDEX idx_metric_value_metric ON public.metric_value(metric_id);
CREATE INDEX idx_metric_value_site ON public.metric_value(site_id);
CREATE INDEX idx_metric_value_period ON public.metric_value(period_id);
CREATE INDEX idx_metric_value_status ON public.metric_value(status);
CREATE INDEX idx_metric_value_submitted_by ON public.metric_value(submitted_by);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

-- Enable RLS on all tables
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_period ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esg_dimension ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esg_theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esg_metric ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT is_active FROM public.app_user_profile WHERE user_id = _user_id),
        false
    )
$$;

-- Function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id FROM public.app_user_profile WHERE user_id = _user_id
$$;

-- Function to get user's site_id
CREATE OR REPLACE FUNCTION public.get_user_site(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT site_id FROM public.app_user_profile WHERE user_id = _user_id
$$;

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger function to update last_updated for metric_value
CREATE OR REPLACE FUNCTION public.update_metric_value_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.last_updated = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply update triggers
CREATE TRIGGER update_company_updated_at BEFORE UPDATE ON public.company FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_updated_at BEFORE UPDATE ON public.site FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reporting_period_updated_at BEFORE UPDATE ON public.reporting_period FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_esg_dimension_updated_at BEFORE UPDATE ON public.esg_dimension FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_esg_theme_updated_at BEFORE UPDATE ON public.esg_theme FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_esg_metric_updated_at BEFORE UPDATE ON public.esg_metric FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_metric_value_updated_at BEFORE UPDATE ON public.metric_value FOR EACH ROW EXECUTE FUNCTION public.update_metric_value_timestamps();
CREATE TRIGGER update_app_user_profile_updated_at BEFORE UPDATE ON public.app_user_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for user_roles (only admins can manage, users can see own)
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for app_user_profile
CREATE POLICY "Users can view own profile" ON public.app_user_profile FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.app_user_profile FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.app_user_profile FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all profiles" ON public.app_user_profile FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for master tables (read by all authenticated, write by admin only)
CREATE POLICY "Authenticated users can view companies" ON public.company FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));
CREATE POLICY "Admins can manage companies" ON public.company FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view sites" ON public.site FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));
CREATE POLICY "Admins can manage sites" ON public.site FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view reporting_periods" ON public.reporting_period FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));
CREATE POLICY "Admins can manage reporting_periods" ON public.reporting_period FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view dimensions" ON public.esg_dimension FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));
CREATE POLICY "Admins can manage dimensions" ON public.esg_dimension FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view themes" ON public.esg_theme FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));
CREATE POLICY "Admins can manage themes" ON public.esg_theme FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view metrics" ON public.esg_metric FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));
CREATE POLICY "Admins can manage metrics" ON public.esg_metric FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for metric_value (complex role-based access)
-- Everyone can view approved values
CREATE POLICY "All can view approved metric values" ON public.metric_value FOR SELECT TO authenticated 
    USING (public.is_user_active(auth.uid()) AND status = 'approved');

-- Staff can view their own submissions
CREATE POLICY "Staff can view own submissions" ON public.metric_value FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'staff') AND submitted_by = auth.uid());

-- Supervisors can view all in their scope
CREATE POLICY "Supervisors can view scoped values" ON public.metric_value FOR SELECT TO authenticated 
    USING (
        public.has_role(auth.uid(), 'supervisor') AND
        (
            public.get_user_site(auth.uid()) IS NULL OR 
            site_id = public.get_user_site(auth.uid())
        ) AND
        (
            public.get_user_company(auth.uid()) IS NULL OR 
            site_id IN (SELECT s.site_id FROM public.site s WHERE s.company_id = public.get_user_company(auth.uid()))
        )
    );

-- Executives and Admins can view all
CREATE POLICY "Executives can view all values" ON public.metric_value FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'executive'));
CREATE POLICY "Admins can view all values" ON public.metric_value FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Staff can insert own draft values
CREATE POLICY "Staff can insert draft values" ON public.metric_value FOR INSERT TO authenticated 
    WITH CHECK (
        (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin')) AND 
        submitted_by = auth.uid() AND 
        status IN ('draft', 'submitted')
    );

-- Staff can update own draft values
CREATE POLICY "Staff can update own drafts" ON public.metric_value FOR UPDATE TO authenticated 
    USING (
        public.has_role(auth.uid(), 'staff') AND 
        submitted_by = auth.uid() AND 
        status = 'draft'
    );

-- Supervisors can update status (approve/reject)
CREATE POLICY "Supervisors can approve/reject" ON public.metric_value FOR UPDATE TO authenticated 
    USING (
        public.has_role(auth.uid(), 'supervisor') AND 
        status = 'submitted' AND
        (
            public.get_user_site(auth.uid()) IS NULL OR 
            site_id = public.get_user_site(auth.uid())
        )
    );

-- Admins have full access to metric_value
CREATE POLICY "Admins can manage all metric values" ON public.metric_value FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_log (only admins can view)
CREATE POLICY "Admins can view audit logs" ON public.audit_log FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit logs" ON public.audit_log FOR INSERT TO authenticated 
    WITH CHECK (true);

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT DEFAULT NULL,
    p_before JSONB DEFAULT NULL,
    p_after JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, before_data, after_data)
    VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after)
    RETURNING log_id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- Function to handle new user signup - create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.app_user_profile (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
    RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed Data: Company
INSERT INTO public.company (company_id, company_name, industry, country) VALUES
('COMP001', 'ESG Demo Corporation', 'Manufacturing', 'Thailand');

-- Seed Data: Sites
INSERT INTO public.site (site_id, company_id, site_name, location) VALUES
('SITE001', 'COMP001', 'Head Office', 'Bangkok'),
('SITE002', 'COMP001', 'Factory 1', 'Rayong'),
('SITE003', 'COMP001', 'Distribution Center', 'Chonburi');

-- Seed Data: Reporting Periods (2024)
INSERT INTO public.reporting_period (period_id, year, month, month_name) VALUES
('2024-01', 2024, 1, 'January'),
('2024-02', 2024, 2, 'February'),
('2024-03', 2024, 3, 'March'),
('2024-04', 2024, 4, 'April'),
('2024-05', 2024, 5, 'May'),
('2024-06', 2024, 6, 'June'),
('2024-07', 2024, 7, 'July'),
('2024-08', 2024, 8, 'August'),
('2024-09', 2024, 9, 'September'),
('2024-10', 2024, 10, 'October'),
('2024-11', 2024, 11, 'November'),
('2024-12', 2024, 12, 'December');

-- Seed Data: ESG Dimensions
INSERT INTO public.esg_dimension (dimension_id, dimension_name) VALUES
('DIM001', 'Environment'),
('DIM002', 'Social'),
('DIM003', 'Governance');

-- Seed Data: ESG Themes
INSERT INTO public.esg_theme (theme_id, dimension_id, theme_name) VALUES
('THM001', 'DIM001', 'Energy Management'),
('THM002', 'DIM001', 'Emissions'),
('THM003', 'DIM001', 'Water Management'),
('THM004', 'DIM002', 'Employee Welfare'),
('THM005', 'DIM002', 'Health & Safety'),
('THM006', 'DIM002', 'Community Engagement'),
('THM007', 'DIM003', 'Business Ethics'),
('THM008', 'DIM003', 'Risk Management');

-- Seed Data: ESG Metrics
INSERT INTO public.esg_metric (metric_id, theme_id, metric_name, unit) VALUES
('MET001', 'THM001', 'Electricity Consumption', 'kWh'),
('MET002', 'THM001', 'Renewable Energy Usage', '%'),
('MET003', 'THM002', 'CO2 Emissions (Scope 1)', 'tCO2e'),
('MET004', 'THM002', 'CO2 Emissions (Scope 2)', 'tCO2e'),
('MET005', 'THM003', 'Water Consumption', 'm³'),
('MET006', 'THM003', 'Water Recycled', '%'),
('MET007', 'THM004', 'Training Hours per Employee', 'hours'),
('MET008', 'THM004', 'Employee Turnover Rate', '%'),
('MET009', 'THM005', 'Lost Time Injury Rate', 'cases per million hours'),
('MET010', 'THM005', 'Safety Training Completion', '%'),
('MET011', 'THM006', 'Community Investment', 'THB'),
('MET012', 'THM007', 'Anti-corruption Training Completion', '%'),
('MET013', 'THM008', 'Risk Assessments Completed', 'count');