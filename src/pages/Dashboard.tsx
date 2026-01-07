import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

interface DashboardStats {
  totalCompanies: number;
  totalSites: number;
  totalMetrics: number;
  pendingApprovals: number;
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
    pendingApprovals: 0,
    myDrafts: 0,
    mySubmitted: 0,
  });
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

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
        { count: pendingCount },
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
        pendingApprovals: pendingCount || 0,
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

        setUserRoles(rolesWithProfile);
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const statCards = [
    {
      title: t('totalCompanies'),
      value: stats.totalCompanies,
      icon: Building2,
      color: 'text-primary',
      roles: ['admin', 'executive'],
    },
    {
      title: t('totalSites'),
      value: stats.totalSites,
      icon: MapPin,
      color: 'text-primary',
      roles: ['admin', 'executive', 'supervisor'],
    },
    {
      title: t('totalMetrics'),
      value: stats.totalMetrics,
      icon: Activity,
      color: 'text-primary',
      roles: ['admin', 'executive', 'supervisor'],
    },
    {
      title: t('pendingApprovals'),
      value: stats.pendingApprovals,
      icon: Clock,
      color: 'text-destructive',
      roles: ['admin', 'supervisor'],
    },
  ];

  const quickActions = {
    admin: [
      { label: t('dataEntry'), href: '/data-entry', icon: FileInput },
      { label: t('review'), href: '/review', icon: CheckSquare },
      { label: t('reports'), href: '/reports', icon: BarChart3 },
      { label: t('users'), href: '/users', icon: Building2 },
    ],
    executive: [
      { label: t('reports'), href: '/reports', icon: BarChart3 },
    ],
    supervisor: [
      { label: t('review'), href: '/review', icon: CheckSquare },
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
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Staff-specific cards */}
      {role === 'staff' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'th' ? 'รายการร่างของฉัน' : 'My Drafts'}
              </CardTitle>
              <FileInput className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.myDrafts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'th' ? 'รายการที่ส่งแล้ว' : 'My Submissions'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.mySubmitted}</div>
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
                        <Badge variant={item.role === 'admin' ? 'destructive' : 'secondary'}>
                          {item.role}
                        </Badge>
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
    </div>
  );
}
