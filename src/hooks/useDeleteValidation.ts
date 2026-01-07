import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface DependencyCheck {
  table: 'site' | 'app_user_profile' | 'metric_value' | 'esg_theme' | 'esg_metric';
  column: string;
  labelTh: string;
  labelEn: string;
}

export function useDeleteValidation() {
  const { language } = useLanguage();

  const checkDependencies = async (
    entityId: string,
    dependencies: DependencyCheck[]
  ): Promise<{ canDelete: boolean; message: string }> => {
    const foundDependencies: string[] = [];

    for (const dep of dependencies) {
      let count = 0;
      
      if (dep.table === 'site') {
        const result = await supabase.from('site').select('*', { count: 'exact', head: true }).eq(dep.column as 'company_id', entityId);
        count = result.count || 0;
      } else if (dep.table === 'app_user_profile') {
        const result = await supabase.from('app_user_profile').select('*', { count: 'exact', head: true }).eq(dep.column as 'company_id' | 'site_id', entityId);
        count = result.count || 0;
      } else if (dep.table === 'metric_value') {
        const result = await supabase.from('metric_value').select('*', { count: 'exact', head: true }).eq(dep.column as 'site_id' | 'metric_id' | 'period_id', entityId);
        count = result.count || 0;
      } else if (dep.table === 'esg_theme') {
        const result = await supabase.from('esg_theme').select('*', { count: 'exact', head: true }).eq(dep.column as 'dimension_id', entityId);
        count = result.count || 0;
      } else if (dep.table === 'esg_metric') {
        const result = await supabase.from('esg_metric').select('*', { count: 'exact', head: true }).eq(dep.column as 'theme_id', entityId);
        count = result.count || 0;
      }

      if (count > 0) {
        const label = language === 'th' ? dep.labelTh : dep.labelEn;
        foundDependencies.push(`${label} (${count} ${language === 'th' ? 'รายการ' : 'records'})`);
      }
    }

    if (foundDependencies.length > 0) {
      const message = language === 'th'
        ? `ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่เกี่ยวข้องอยู่:\n• ${foundDependencies.join('\n• ')}`
        : `Cannot delete. Related data exists:\n• ${foundDependencies.join('\n• ')}`;
      
      return { canDelete: false, message };
    }

    return { canDelete: true, message: '' };
  };

  // Company dependencies: Site, app_user_profile
  const checkCompanyDependencies = (companyId: string) => {
    return checkDependencies(companyId, [
      { table: 'site', column: 'company_id', labelTh: 'ไซต์/สถานที่', labelEn: 'Sites' },
      { table: 'app_user_profile', column: 'company_id', labelTh: 'ผู้ใช้งาน', labelEn: 'Users' },
    ]);
  };

  // Site dependencies: metric_value, app_user_profile
  const checkSiteDependencies = (siteId: string) => {
    return checkDependencies(siteId, [
      { table: 'metric_value', column: 'site_id', labelTh: 'ข้อมูล ESG', labelEn: 'ESG Data' },
      { table: 'app_user_profile', column: 'site_id', labelTh: 'ผู้ใช้งาน', labelEn: 'Users' },
    ]);
  };

  // Dimension dependencies: esg_theme
  const checkDimensionDependencies = (dimensionId: string) => {
    return checkDependencies(dimensionId, [
      { table: 'esg_theme', column: 'dimension_id', labelTh: 'หัวข้อ ESG', labelEn: 'ESG Themes' },
    ]);
  };

  // Theme dependencies: esg_metric
  const checkThemeDependencies = (themeId: string) => {
    return checkDependencies(themeId, [
      { table: 'esg_metric', column: 'theme_id', labelTh: 'ตัวชี้วัด ESG', labelEn: 'ESG Metrics' },
    ]);
  };

  // Metric dependencies: metric_value
  const checkMetricDependencies = (metricId: string) => {
    return checkDependencies(metricId, [
      { table: 'metric_value', column: 'metric_id', labelTh: 'ข้อมูล ESG', labelEn: 'ESG Data' },
    ]);
  };

  // Period dependencies: metric_value
  const checkPeriodDependencies = (periodId: string) => {
    return checkDependencies(periodId, [
      { table: 'metric_value', column: 'period_id', labelTh: 'ข้อมูล ESG', labelEn: 'ESG Data' },
    ]);
  };

  return {
    checkCompanyDependencies,
    checkSiteDependencies,
    checkDimensionDependencies,
    checkThemeDependencies,
    checkMetricDependencies,
    checkPeriodDependencies,
  };
}
