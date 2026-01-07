import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  Shield,
  Eye,
  Crown,
  Briefcase,
  UserCheck,
  User,
  UserX,
} from 'lucide-react';

interface DetailData {
  type: 'companies' | 'sites' | 'metrics' | 'pending' | 'drafts' | 'submitted';
  title: string;
  items: any[];
}

interface DashboardStats {
  totalCompanies: number;
  totalSites: number;
  totalMetrics: number;
  totalSubmitted: number;
  myDrafts: number;
  mySubmitted: number;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
}

export default function Dashboard() {
  const { role, user } = useAuth();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    totalSites: 0,
    totalMetrics: 0,
    totalSubmitted: 0,
    myDrafts: 0,
    mySubmitted: 0,
  });
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    if (role === 'admin') {
      fetchUserRoles();
    }
  }, [user, role]);

  const fetchStats = async () => {
    try {
      const [
        { count: companiesCount },
        { count: sitesCount },
        { count: metricsCount },
        { count: submittedTotalCount },
        { count: draftsCount },
        { count: submittedCount },
      ] = await Promise.all([
        supabase.from('company').select('*', { count: 'exact', head: true }),
        supabase.from('site').select('*', { count: 'exact', head: true }),
        supabase.from('esg_metric').select('*', { count: 'exact', head: true }),
        supabase.from('metric_value').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('metric_value').select('*', { count: 'exact', head: true }).eq('status', 'draft').eq('submitted_by', user?.id || ''),
        supabase.from('metric_value').select('*', { count: 'exact', head: true }).eq('submitted_by', user?.id || ''),
      ]);

      setStats({
        totalCompanies: companiesCount || 0,
        totalSites: sitesCount || 0,
        totalMetrics: metricsCount || 0,
        totalSubmitted: submittedTotalCount || 0,
        myDrafts: draftsCount || 0,
        mySubmitted: submittedCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
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
      return <p className="text-muted-foreground">{language === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>;
    }

    if (detailData.items.length === 0) {
      return <p className="text-muted-foreground">{language === 'th' ? 'ไม่พบข้อมูล' : 'No data found'}</p>;
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
                  <TableCell>{item.value}</TableCell>
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
      color: 'text-primary',
      roles: ['admin', 'executive'],
      detailType: 'companies' as const,
    },
    {
      title: t('totalSites'),
      value: stats.totalSites,
      icon: MapPin,
      color: 'text-primary',
      roles: ['admin', 'executive', 'supervisor'],
      detailType: 'sites' as const,
    },
    {
      title: t('totalMetrics'),
      value: stats.totalMetrics,
      icon: Activity,
      color: 'text-primary',
      roles: ['admin', 'executive', 'supervisor'],
      detailType: 'metrics' as const,
    },
    {
      title: language === 'th' ? 'ข้อมูลที่ส่งแล้ว' : 'Total Submitted',
      value: stats.totalSubmitted,
      icon: Clock,
      color: 'text-secondary',
      roles: ['admin', 'supervisor'],
      detailType: 'submitted' as const,
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
      { label: t('reports'), href: '/reports', icon: BarChart3 },
    ],
    staff: [
      { label: t('dataEntry'), href: '/data-entry', icon: FileInput },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>
        <p className="text-muted-foreground">
          {language === 'th' ? 'ภาพรวมข้อมูล ESG' : 'ESG Data Overview'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards
          .filter((card) => card.roles.includes(role || ''))
          .map((card) => (
            <Card 
              key={card.title} 
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
              onClick={() => fetchDetailData(card.detailType, card.title)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{card.value}</div>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Staff-specific cards */}
      {role === 'staff' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card 
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => fetchDetailData('drafts', language === 'th' ? 'รายการร่างของฉัน' : 'My Drafts')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'th' ? 'รายการร่างของฉัน' : 'My Drafts'}
              </CardTitle>
              <FileInput className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats.myDrafts}</div>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => fetchDetailData('submitted', language === 'th' ? 'รายการที่ส่งแล้ว' : 'My Submissions')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'th' ? 'รายการที่ส่งแล้ว' : 'My Submissions'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats.mySubmitted}</div>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Roles Table (Admin only) */}
      {role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {language === 'th' ? 'ตารางสิทธิ์ผู้ใช้งาน' : 'User Roles Table'}
            </CardTitle>
            <CardDescription>
              {language === 'th' ? 'รายการ Role ทั้งหมดในระบบ' : 'All user roles in the system'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userRoles.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {language === 'th' ? 'ไม่พบข้อมูล Role' : 'No roles found'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'th' ? 'ชื่อผู้ใช้' : 'User Name'}</TableHead>
                    <TableHead>{language === 'th' ? 'User ID' : 'User ID'}</TableHead>
                    <TableHead>{language === 'th' ? 'บทบาท' : 'Role'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.full_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.user_id}</TableCell>
                      <TableCell>
                        {item.role === 'admin' && (
                          <Badge className="bg-destructive text-destructive-foreground gap-1.5">
                            <Crown className="h-3 w-3" />
                            {item.role}
                          </Badge>
                        )}
                        {item.role === 'executive' && (
                          <Badge className="bg-primary text-primary-foreground gap-1.5">
                            <Briefcase className="h-3 w-3" />
                            {item.role}
                          </Badge>
                        )}
                        {item.role === 'supervisor' && (
                          <Badge className="bg-accent text-accent-foreground border border-border gap-1.5">
                            <UserCheck className="h-3 w-3" />
                            {item.role}
                          </Badge>
                        )}
                        {item.role === 'staff' && (
                          <Badge className="bg-secondary text-secondary-foreground gap-1.5">
                            <User className="h-3 w-3" />
                            {item.role}
                          </Badge>
                        )}
                        {item.role === 'guest' && (
                          <Badge className="bg-muted text-muted-foreground gap-1.5">
                            <UserX className="h-3 w-3" />
                            {item.role}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickActions')}</CardTitle>
          <CardDescription>
            {language === 'th' ? 'การดำเนินการที่ใช้บ่อย' : 'Frequently used actions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {role && quickActions[role]?.map((action) => (
              <Button key={action.href} variant="outline" asChild>
                <Link to={action.href} className="gap-2">
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {detailData?.title}
            </DialogTitle>
            <DialogDescription>
              {language === 'th' ? 'รายละเอียดข้อมูล' : 'Data details'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {renderDetailContent()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
