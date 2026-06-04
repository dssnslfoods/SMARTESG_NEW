import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SuperAdminPanel from '@/components/dashboard/SuperAdminPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  MapPin,
  Activity,
  Clock,
  FileInput,
  CheckSquare,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Shield,
  Eye,
  Crown,
  Briefcase,
  UserCheck,
  User,
  UserX,
  ChevronRight,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';
import { DashboardLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { LoadingOverlay } from '@/components/ui/loading-progress';
import AdminAnalyticsDashboard from '@/components/dashboard/AdminAnalyticsDashboard';
import { useOptimizedMetricValues, invalidateMetricValueCache } from '@/hooks/useOptimizedData';
import { FETCH_CONFIG } from '@/lib/dataFetcher';

interface DetailData {
  type: 'companies' | 'sites' | 'metrics' | 'pending' | 'drafts' | 'submitted';
  title: string;
  items: any[];
}

interface MasterStats {
  totalCompanies: number;
  totalSites: number;
  totalMetrics: number;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
}

export default function Dashboard() {
  const { role, user, isSuperAdmin } = useAuth();
  const { t, language } = useLanguage();
  
  // Use optimized hook for metric values
  const { 
    stats: metricStats, 
    loading: metricLoading, 
    refresh: refreshMetrics,
    progress 
  } = useOptimizedMetricValues(user?.id);

  const [masterStats, setMasterStats] = useState<MasterStats>({
    totalCompanies: 0,
    totalSites: 0,
    totalMetrics: 0,
  });
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Combined loading state
  const loading = metricLoading || masterLoading;

  // Combined stats for compatibility
  const stats = useMemo(() => ({
    ...masterStats,
    totalDbRecords: metricStats.totalDbRecords,
    visibleRecords: metricStats.visibleRecords,
    draftCount: metricStats.draftCount,
    submittedCount: metricStats.submittedCount,
    myDrafts: metricStats.myDrafts,
    mySubmitted: metricStats.mySubmitted,
  }), [masterStats, metricStats]);

  const handleRefresh = useCallback(async () => {
    invalidateMetricValueCache();
    await Promise.all([
      refreshMetrics(),
      fetchMasterStats(),
      role === 'admin' ? fetchUserRoles() : Promise.resolve(),
    ]);
  }, [role, refreshMetrics]);

  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  useEffect(() => {
    fetchMasterStats();
    if (role === 'admin') {
      fetchUserRoles();
    }
  }, [user, role]);

  const fetchMasterStats = async () => {
    try {
      const [
        { count: companiesCount },
        { count: sitesCount },
        { count: metricsCount },
      ] = await Promise.all([
        supabase.from('company').select('company_id', { count: 'exact', head: true }),
        supabase.from('site').select('site_id', { count: 'exact', head: true }),
        supabase.from('esg_metric').select('metric_id', { count: 'exact', head: true }),
      ]);

      setMasterStats({
        totalCompanies: companiesCount || 0,
        totalSites: sitesCount || 0,
        totalMetrics: metricsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching master stats:', error);
    } finally {
      setMasterLoading(false);
    }
  };

  const fetchUserRoles = async () => {
    try {
      // Fetch user roles with profile info
      const { data: rolesData, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role');

      if (error) throw error;

      if (rolesData) {
        // Fetch profiles for each user
        const userIds = rolesData.map(r => r.user_id);
        const { data: profilesData } = await supabase
          .from('app_user_profile')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const rolesWithProfile = rolesData.map(roleItem => ({
          ...roleItem,
          full_name: profilesData?.find(p => p.user_id === roleItem.user_id)?.full_name || 'N/A',
        }));

        // Sort by role order: admin, executive, supervisor, staff, guest
        const roleOrder = ['admin', 'executive', 'supervisor', 'staff', 'guest'];
        const sortedRoles = rolesWithProfile.sort((a, b) => {
          const orderA = roleOrder.indexOf(a.role);
          const orderB = roleOrder.indexOf(b.role);
          return orderA - orderB;
        });

        setUserRoles(sortedRoles);
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const fetchDetailData = async (type: DetailData['type'], title: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetailData({ type, title, items: [] });

    try {
      let items: any[] = [];

      switch (type) {
        case 'companies': {
          const { data } = await supabase.from('company').select('*').limit(50);
          items = data || [];
          break;
        }
        case 'sites': {
          const { data } = await supabase.from('site').select('*, company:company_id(company_name)').limit(50);
          items = data || [];
          break;
        }
        case 'metrics': {
          const { data } = await supabase.from('esg_metric').select('*, theme:theme_id(theme_name)').limit(50);
          items = data || [];
          break;
        }
        case 'pending': {
          const { data } = await supabase
            .from('metric_value')
            .select('*, metric:metric_id(metric_name), site:site_id(site_name)')
            .eq('status', 'submitted')
            .limit(50);
          items = data || [];
          break;
        }
        case 'drafts': {
          const { data } = await supabase
            .from('metric_value')
            .select('*, metric:metric_id(metric_name), site:site_id(site_name)')
            .eq('status', 'draft')
            .eq('submitted_by', user?.id || '')
            .limit(50);
          items = data || [];
          break;
        }
        case 'submitted': {
          const { data } = await supabase
            .from('metric_value')
            .select('*, metric:metric_id(metric_name), site:site_id(site_name)')
            .eq('submitted_by', user?.id || '')
            .limit(50);
          items = data || [];
          break;
        }
      }

      setDetailData({ type, title, items });
    } catch (error) {
      console.error('Error fetching detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderDetailContent = () => {
    if (!detailData) return null;

    if (detailLoading) {
      return <p className="text-gray-500">{language === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>;
    }

    if (detailData.items.length === 0) {
      return <p className="text-gray-500">{language === 'th' ? 'ไม่พบข้อมูล' : 'No data found'}</p>;
    }

    switch (detailData.type) {
      case 'companies':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'th' ? 'ชื่อบริษัท' : 'Company Name'}</TableHead>
                <TableHead>{language === 'th' ? 'อุตสาหกรรม' : 'Industry'}</TableHead>
                <TableHead>{language === 'th' ? 'ประเทศ' : 'Country'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailData.items.map((item) => (
                <TableRow key={item.company_id}>
                  <TableCell className="font-medium">{item.company_name}</TableCell>
                  <TableCell>{item.industry || '-'}</TableCell>
                  <TableCell>{item.country || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'sites':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'th' ? 'ชื่อไซต์' : 'Site Name'}</TableHead>
                <TableHead>{language === 'th' ? 'บริษัท' : 'Company'}</TableHead>
                <TableHead>{language === 'th' ? 'ที่ตั้ง' : 'Location'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailData.items.map((item) => (
                <TableRow key={item.site_id}>
                  <TableCell className="font-medium">{item.site_name}</TableCell>
                  <TableCell>{item.company?.company_name || '-'}</TableCell>
                  <TableCell>{item.location || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'metrics':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'th' ? 'ชื่อ Metric' : 'Metric Name'}</TableHead>
                <TableHead>{language === 'th' ? 'หัวข้อ' : 'Theme'}</TableHead>
                <TableHead>{language === 'th' ? 'หน่วย' : 'Unit'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailData.items.map((item) => (
                <TableRow key={item.metric_id}>
                  <TableCell className="font-medium">{item.metric_name}</TableCell>
                  <TableCell>{item.theme?.theme_name || '-'}</TableCell>
                  <TableCell>{item.unit || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'pending':
      case 'drafts':
      case 'submitted':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'th' ? 'Metric' : 'Metric'}</TableHead>
                <TableHead>{language === 'th' ? 'ไซต์' : 'Site'}</TableHead>
                <TableHead>{language === 'th' ? 'ค่า' : 'Value'}</TableHead>
                <TableHead>{language === 'th' ? 'สถานะ' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailData.items.map((item) => (
                <TableRow key={item.value_id}>
                  <TableCell className="font-medium">{item.metric?.metric_name || '-'}</TableCell>
                  <TableCell>{item.site?.site_name || '-'}</TableCell>
                  <TableCell>{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'approved' ? 'default' : item.status === 'submitted' ? 'secondary' : 'outline'}>
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      default:
        return null;
    }
  };

  const statCards = [
    {
      title: t('totalCompanies'),
      value: stats.totalCompanies,
      icon: Building2,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      roles: ['admin', 'executive'],
      detailType: 'companies' as const,
    },
    {
      title: t('totalSites'),
      value: stats.totalSites,
      icon: MapPin,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      roles: ['admin', 'executive', 'supervisor'],
      detailType: 'sites' as const,
    },
    {
      title: t('totalMetrics'),
      value: stats.totalMetrics,
      icon: Activity,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      roles: ['admin', 'executive', 'supervisor'],
      detailType: 'metrics' as const,
    },
  ];

  const quickActions = {
    admin: [
      { label: t('dataEntry'), href: '/data-entry', icon: FileInput },
      { label: t('reports'), href: '/reports', icon: BarChart3 },
      { label: t('users'), href: '/users', icon: Building2 },
    ],
    executive: [
      { label: t('reports'), href: '/reports', icon: BarChart3 },
    ],
    supervisor: [
      { label: t('dataEntry'), href: '/data-entry', icon: FileInput },
    ],
    staff: [
      { label: t('dataEntry'), href: '/data-entry', icon: FileInput },
    ],
  };

  if (loading) {
    return (
      <>
        <LoadingOverlay
          loaded={progress.loaded}
          total={progress.total}
          isLoading={metricLoading && progress.loaded > 0}
          message="กำลังโหลดข้อมูล Dashboard"
        />
        <DashboardLoadingSkeleton />
      </>
    );
  }

  // Executive now uses the standard Dashboard (the dedicated Executive ESG
  // Dashboard view was removed per request).

  return (
    <div
      ref={containerRef}
      className="space-y-4 sm:space-y-6 h-full overflow-y-auto min-h-full p-1"
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* ── Super-admin only: cross-tenant platform overview ─────────────── */}
      {isSuperAdmin && <SuperAdminPanel />}

      {/* Page Header */}
      <div className="px-1">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('dashboard')}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {language === 'th' ? 'ภาพรวมข้อมูล ESG' : 'ESG Data Overview'}
        </p>
      </div>

      {/* Stats Grid - Liquid Glass Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards
          .filter((card) => card.roles.includes(role || ''))
          .map((card) => (
            <Card 
              key={card.title} 
              className="glass-card cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
              onClick={() => fetchDetailData(card.detailType, card.title)}
            >
              <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
                  {card.title}
                </CardTitle>
                <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
                  <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                <div className="flex items-center justify-between">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Staff-specific cards */}
      {role === 'staff' && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2">
          <Card 
            className="glass-card cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
            onClick={() => fetchDetailData('drafts', language === 'th' ? 'รายการร่างของฉัน' : 'My Drafts')}
          >
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
                {language === 'th' ? 'รายการร่างของฉัน' : 'My Drafts'}
              </CardTitle>
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <FileInput className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-foreground">{(stats.myDrafts ?? 0).toLocaleString()}</div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
          <Card 
            className="glass-card cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
            onClick={() => fetchDetailData('submitted', language === 'th' ? 'รายการที่ส่งแล้ว' : 'My Submissions')}
          >
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
                {language === 'th' ? 'รายการที่ส่งแล้ว' : 'My Submissions'}
              </CardTitle>
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-foreground">{(stats.mySubmitted ?? 0).toLocaleString()}</div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin Analytics Dashboard */}
      {role === 'admin' && <AdminAnalyticsDashboard />}

      {/* User Roles Table (Admin only) - Liquid Glass Card */}
      {role === 'admin' && (
        <Card className="glass-card-solid">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground">
              <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Shield className="h-4 w-4 text-indigo-600" />
              </div>
              {language === 'th' ? 'ตารางสิทธิ์ผู้ใช้งาน' : 'User Roles Table'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {language === 'th' ? 'รายการ Role ทั้งหมดในระบบ' : 'All user roles in the system'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {userRoles.length === 0 ? (
              <p className="text-muted-foreground text-xs sm:text-sm">
                {language === 'th' ? 'ไม่พบข้อมูล Role' : 'No roles found'}
              </p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="text-xs sm:text-sm">{language === 'th' ? 'ชื่อผู้ใช้' : 'User Name'}</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">{language === 'th' ? 'User ID' : 'User ID'}</TableHead>
                      <TableHead className="text-xs sm:text-sm">{language === 'th' ? 'บทบาท' : 'Role'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userRoles.map((item) => (
                      <TableRow key={item.id} className="border-border/50 hover:bg-muted/40">
                        <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-4 text-foreground">{item.full_name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground hidden sm:table-cell">{item.user_id}</TableCell>
                        <TableCell className="py-2 sm:py-4">
                          {item.role === 'admin' && (
                            <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 gap-1 sm:gap-1.5 text-xs rounded-full shadow-sm">
                              <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span className="hidden sm:inline">{item.role}</span>
                              <span className="sm:hidden">A</span>
                            </Badge>
                          )}
                          {item.role === 'executive' && (
                            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1 sm:gap-1.5 text-xs rounded-full shadow-sm">
                              <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span className="hidden sm:inline">{item.role}</span>
                              <span className="sm:hidden">E</span>
                            </Badge>
                          )}
                          {item.role === 'supervisor' && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1 sm:gap-1.5 text-xs rounded-full shadow-sm">
                              <UserCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span className="hidden sm:inline">{item.role}</span>
                              <span className="sm:hidden">SV</span>
                            </Badge>
                          )}
                          {item.role === 'staff' && (
                            <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 gap-1 sm:gap-1.5 text-xs rounded-full shadow-sm">
                              <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span className="hidden sm:inline">{item.role}</span>
                              <span className="sm:hidden">S</span>
                            </Badge>
                          )}
                          {item.role === 'guest' && (
                            <Badge className="bg-muted text-muted-foreground border border-border gap-1 sm:gap-1.5 text-xs rounded-full">
                              <UserX className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span className="hidden sm:inline">{item.role}</span>
                              <span className="sm:hidden">G</span>
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions - Liquid Glass Card */}
      <Card className="glass-card-solid">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg text-foreground">{t('quickActions')}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {language === 'th' ? 'การดำเนินการที่ใช้บ่อย' : 'Frequently used actions'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
            {role && quickActions[role]?.map((action) => (
              <Button 
                key={action.href} 
                variant="outline" 
                asChild 
                className="w-full sm:w-auto justify-start sm:justify-center h-10 sm:h-9 text-sm hover:shadow-lg hover:border-primary/40 rounded-2xl transition-all duration-200"
              >
                <Link to={action.href} className="gap-2">
                  <action.icon className="h-4 w-4 text-primary" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog - Liquid Glass Style */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-auto p-4 sm:p-6 glass-card-solid rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground">
              <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Eye className="h-4 w-4 text-emerald-600" />
              </div>
              {detailData?.title}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {language === 'th' ? 'รายละเอียดข้อมูล' : 'Data details'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 sm:mt-4 overflow-x-auto">
            {renderDetailContent()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
