-- Add supervisor management policies for all master data tables

-- Company table
CREATE POLICY "Supervisors can manage companies" 
ON public.company 
FOR ALL 
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Site table
CREATE POLICY "Supervisors can manage sites" 
ON public.site 
FOR ALL 
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- ESG Dimension table
CREATE POLICY "Supervisors can manage dimensions" 
ON public.esg_dimension 
FOR ALL 
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- ESG Theme table
CREATE POLICY "Supervisors can manage themes" 
ON public.esg_theme 
FOR ALL 
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- ESG Metric table
CREATE POLICY "Supervisors can manage metrics" 
ON public.esg_metric 
FOR ALL 
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Reporting Period table
CREATE POLICY "Supervisors can manage reporting_periods" 
ON public.reporting_period 
FOR ALL 
USING (has_role(auth.uid(), 'supervisor'::app_role));