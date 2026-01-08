import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Search, UserPlus, Trash2, KeyRound } from 'lucide-react';

type AppRole = 'admin' | 'executive' | 'supervisor' | 'staff' | 'guest';

interface UserWithRole {
  user_id: string;
  full_name: string | null;
  company_id: string | null;
  site_id: string | null;
  is_active: boolean;
  created_at: string;
  role: AppRole | null;
  email: string;
}

interface Company {
  company_id: string;
  company_name: string;
}

interface Site {
  site_id: string;
  site_name: string;
  company_id: string;
}

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  executive: 'bg-primary text-primary-foreground',
  supervisor: 'bg-accent text-accent-foreground border border-border',
  staff: 'bg-secondary text-secondary-foreground',
  guest: 'bg-muted text-muted-foreground',
};

export default function UserManagement() {
  const { t, language } = useLanguage();
  const { role: currentUserRole, user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [originalEmail, setOriginalEmail] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);

  // New user registration form
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'staff' as AppRole,
    companyId: '',
    siteId: '',
  });
  const [addingUser, setAddingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  // Password change
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserWithRole | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Check if current user is admin or supervisor (can manage others)
  const isManager = currentUserRole === 'admin' || currentUserRole === 'supervisor';
  // Check if current user is staff or executive (can only manage self)
  const isSelfOnly = currentUserRole === 'executive' || currentUserRole === 'staff';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, rolesRes, companiesRes, sitesRes] = await Promise.all([
        supabase.from('app_user_profile').select('*'),
        supabase.from('user_roles').select('*'),
        supabase.from('company').select('company_id, company_name'),
        supabase.from('site').select('site_id, site_name, company_id'),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      
      // Fetch emails from auth users via edge function or admin API
      // For now, we'll need to get emails when editing
      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role as AppRole || null,
          email: '', // Will be fetched when editing
        };
      });

      setUsers(usersWithRoles);
      setCompanies(companiesRes.data || []);
      setSites(sitesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all required fields',
      });
      return;
    }

    // Staff, Supervisor, Executive roles require company and site
    const rolesRequiringCompanySite = ['staff', 'supervisor', 'executive'];
    if (rolesRequiringCompanySite.includes(newUser.role) && (!newUser.companyId || !newUser.siteId)) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: language === 'th' 
          ? `บทบาท ${t(newUser.role)} ต้องเลือกบริษัทและสถานที่` 
          : `${t(newUser.role)} role requires company and site selection`,
      });
      return;
    }

    setAddingUser(true);
    try {
      // Call edge function to create user (admin only)
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUser.email,
          password: newUser.password,
          fullName: newUser.fullName,
          role: newUser.role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update profile with company/site if provided
      if (data?.userId && (newUser.companyId || newUser.siteId)) {
        await supabase
          .from('app_user_profile')
          .update({
            company_id: newUser.companyId || null,
            site_id: newUser.siteId || null,
          })
          .eq('user_id', data.userId);
      }

      toast({
        title: t('success'),
        description: language === 'th' ? 'เพิ่มผู้ใช้สำเร็จ' : 'User added successfully',
      });

      setIsAddDialogOpen(false);
      setNewUser({
        email: '',
        password: '',
        fullName: '',
        role: 'staff',
        companyId: '',
        siteId: '',
      });
      fetchData();
    } catch (error: any) {
      // Translate common error messages
      let errorMessage = error.message;
      if (error.message?.includes('email address has already been registered') || 
          error.message?.includes('email_exists')) {
        errorMessage = language === 'th' 
          ? 'อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น' 
          : 'This email is already registered. Please use a different email.';
      } else if (error.message?.includes('Invalid email')) {
        errorMessage = language === 'th' 
          ? 'รูปแบบอีเมลไม่ถูกต้อง' 
          : 'Invalid email format';
      } else if (error.message?.includes('Password')) {
        errorMessage = language === 'th' 
          ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' 
          : 'Password must be at least 6 characters';
      }
      
      toast({
        variant: 'destructive',
        title: t('error'),
        description: errorMessage,
      });
    } finally {
      setAddingUser(false);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    
    // Staff, Supervisor, Executive roles require company and site
    const rolesRequiringCompanySite = ['staff', 'supervisor', 'executive'];
    if (editingUser.role && rolesRequiringCompanySite.includes(editingUser.role) && 
        (!editingUser.company_id || !editingUser.site_id)) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: language === 'th' 
          ? `บทบาท ${t(editingUser.role)} ต้องเลือกบริษัทและสถานที่` 
          : `${t(editingUser.role)} role requires company and site selection`,
      });
      return;
    }
    
    setSaving(true);
    try {
      // Update email if changed
      if (editingUser.email && editingUser.email !== originalEmail) {
        const { data, error: emailError } = await supabase.functions.invoke('update-user-email', {
          body: {
            userId: editingUser.user_id,
            newEmail: editingUser.email,
          },
        });

        if (emailError) throw emailError;
        if (data?.error) throw new Error(data.error);
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('app_user_profile')
        .update({
          full_name: editingUser.full_name,
          company_id: editingUser.company_id,
          site_id: editingUser.site_id,
          is_active: editingUser.is_active,
        })
        .eq('user_id', editingUser.user_id);

      if (profileError) throw profileError;

      // Update or insert role using upsert
      if (editingUser.role) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert(
            { user_id: editingUser.user_id, role: editingUser.role },
            { onConflict: 'user_id' }
          );
        
        if (roleError) throw roleError;
      }

      toast({
        title: t('success'),
        description: language === 'th' ? 'อัปเดตผู้ใช้สำเร็จ' : 'User updated successfully',
      });

      setIsDialogOpen(false);
      setEditingUser(null);
      setOriginalEmail('');
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    // If trying to deactivate, check if this is the last active supervisor
    if (currentStatus) {
      const targetUser = users.find(u => u.user_id === userId);
      if (targetUser?.role === 'supervisor') {
        // Count active supervisors
        const activeSupervisors = users.filter(u => u.role === 'supervisor' && u.is_active);
        if (activeSupervisors.length <= 1) {
          toast({
            variant: 'destructive',
            title: t('error'),
            description: language === 'th' 
              ? 'ไม่สามารถปิดใช้งาน supervisor คนสุดท้ายได้ ระบบต้องมี supervisor อย่างน้อย 1 คน'
              : 'Cannot deactivate the last supervisor. At least one supervisor is required.',
          });
          return;
        }
      }
    }

    setTogglingStatus(userId);
    try {
      const { error } = await supabase
        .from('app_user_profile')
        .update({ is_active: !currentStatus })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: t('success'),
        description: language === 'th' 
          ? (currentStatus ? 'ปิดใช้งานผู้ใช้สำเร็จ' : 'เปิดใช้งานผู้ใช้สำเร็จ')
          : (currentStatus ? 'User deactivated successfully' : 'User activated successfully'),
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message,
      });
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUserId) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: deletingUserId },
      });

      // Business-rule errors are returned as 200 with { success:false, error }
      if (data?.success === false) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: data.error,
        });
        return;
      }

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: t('success'),
        description: language === 'th' ? 'ลบผู้ใช้สำเร็จ' : 'User deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      setDeletingUserId(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordUser) return;

    if (!newPassword || newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: language === 'th' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Password must be at least 6 characters',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: language === 'th' ? 'รหัสผ่านไม่ตรงกัน' : 'Passwords do not match',
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-password', {
        body: {
          email: passwordUser.email,
          newPassword: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: t('success'),
        description: language === 'th' ? 'เปลี่ยนรหัสผ่านสำเร็จ' : 'Password changed successfully',
      });

      setIsPasswordDialogOpen(false);
      setPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message,
      });
    } finally {
      setChangingPassword(false);
    }
  };

  // Filter users based on role
  // Admin sees all, supervisor sees non-admin, executive/staff see only self
  const visibleUsers = isSelfOnly
    ? users.filter(u => u.user_id === currentUser?.id)
    : currentUserRole === 'supervisor' 
      ? users.filter(u => u.role !== 'admin')
      : users;

  const filteredUsers = visibleUsers.filter((user) =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.user_id.includes(searchTerm)
  );

  const filteredSites = editingUser?.company_id
    ? sites.filter((s) => s.company_id === editingUser.company_id)
    : sites;

  const newUserFilteredSites = newUser.companyId
    ? sites.filter((s) => s.company_id === newUser.companyId)
    : sites;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('users')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isSelfOnly 
              ? (language === 'th' ? 'จัดการบัญชีของคุณ' : 'Manage your account')
              : (language === 'th' ? 'จัดการผู้ใช้และบทบาท' : 'Manage users and roles')}
          </p>
        </div>
        
        {isManager && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <UserPlus className="h-4 w-4" />
                {language === 'th' ? 'เพิ่มผู้ใช้' : 'Add User'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {language === 'th' ? 'เพิ่มผู้ใช้ใหม่' : 'Add New User'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('email')} *</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('password')} *</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('fullName')} *</Label>
                <Input
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'th' ? 'บทบาท' : 'Role'}</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: AppRole) => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t('admin')}</SelectItem>
                    <SelectItem value="executive">{t('executive')}</SelectItem>
                    <SelectItem value="supervisor">{t('supervisor')}</SelectItem>
                    <SelectItem value="staff">{t('staff')}</SelectItem>
                    <SelectItem value="guest">{t('guest')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('company')}</Label>
                <Select
                  value={newUser.companyId}
                  onValueChange={(value) => setNewUser({ ...newUser, companyId: value, siteId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกบริษัท' : 'Select company'} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.company_id} value={c.company_id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('site')}</Label>
                <Select
                  value={newUser.siteId}
                  onValueChange={(value) => setNewUser({ ...newUser, siteId: value })}
                  disabled={!newUser.companyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกสถานที่' : 'Select site'} />
                  </SelectTrigger>
                  <SelectContent>
                    {newUserFilteredSites.map((s) => (
                      <SelectItem key={s.site_id} value={s.site_id}>
                        {s.site_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddUser} className="w-full" disabled={addingUser}>
                {addingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {language === 'th' ? 'เพิ่มผู้ใช้' : 'Add User'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm sm:text-base"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">{t('fullName')}</TableHead>
                  <TableHead className="text-xs sm:text-sm">{language === 'th' ? 'บทบาท' : 'Role'}</TableHead>
                  <TableHead className="hidden md:table-cell text-xs sm:text-sm">{t('company')}</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs sm:text-sm">{t('site')}</TableHead>
                  <TableHead className="hidden sm:table-cell text-xs sm:text-sm">{t('status')}</TableHead>
                  <TableHead className="w-24 sm:w-40 text-xs sm:text-sm">{language === 'th' ? 'การดำเนินการ' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-4">
                        <div className="flex flex-col gap-0.5">
                          <span>{user.full_name || '-'}</span>
                          {/* Show role badge on mobile below name */}
                          <div className="sm:hidden">
                            {user.role ? (
                              <Badge className={`${roleColors[user.role]} text-xs px-1.5 py-0`}>
                                {t(user.role)}
                              </Badge>
                            ) : null}
                          </div>
                          {/* Show status indicator on mobile */}
                          <div className="sm:hidden text-xs text-muted-foreground">
                            {user.is_active
                              ? (language === 'th' ? '● ใช้งาน' : '● Active')
                              : (language === 'th' ? '○ ปิดใช้งาน' : '○ Inactive')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {user.role ? (
                          <Badge className={`${roleColors[user.role]} text-xs sm:text-sm`}>
                            {t(user.role)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                        {companies.find((c) => c.company_id === user.company_id)?.company_name || '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                        {sites.find((s) => s.site_id === user.site_id)?.site_name || '-'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' || !isManager ? (
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              {user.is_active
                                ? (language === 'th' ? 'ใช้งาน' : 'Active')
                                : (language === 'th' ? 'ปิดใช้งาน' : 'Inactive')}
                              {user.role === 'admin' && (language === 'th' ? ' (ไม่สามารถเปลี่ยนได้)' : ' (cannot change)')}
                            </span>
                          ) : (
                            <>
                              <Switch
                                checked={user.is_active}
                                disabled={togglingStatus === user.user_id}
                                onCheckedChange={() => handleToggleStatus(user.user_id, user.is_active)}
                              />
                              <span className="text-xs sm:text-sm text-muted-foreground">
                                {user.is_active
                                  ? (language === 'th' ? 'ใช้งาน' : 'Active')
                                  : (language === 'th' ? 'ปิดใช้งาน' : 'Inactive')}
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 sm:py-4">
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          {/* Edit button - only for managers editing others */}
                          {isManager && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                              onClick={async () => {
                                setEditingUser(user);
                                setIsDialogOpen(true);
                                setLoadingEmail(true);
                                try {
                                  const { data, error } = await supabase.functions.invoke('get-user-email', {
                                    body: { userId: user.user_id },
                                  });
                                  if (!error && data?.email) {
                                    setEditingUser(prev => prev ? { ...prev, email: data.email } : null);
                                    setOriginalEmail(data.email);
                                  }
                                } catch (err) {
                                  console.error('Error fetching email:', err);
                                } finally {
                                  setLoadingEmail(false);
                                }
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          )}
                          {/* Password change button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                            onClick={async () => {
                              setLoadingEmail(true);
                              try {
                                const { data, error } = await supabase.functions.invoke('get-user-email', {
                                  body: { userId: user.user_id },
                                });
                                if (!error && data?.email) {
                                  setPasswordUser({ ...user, email: data.email });
                                  setIsPasswordDialogOpen(true);
                                }
                              } catch (err) {
                                console.error('Error fetching email:', err);
                              } finally {
                                setLoadingEmail(false);
                              }
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          {/* Delete button - only for managers, not for admins */}
                          {isManager && user.role !== 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeletingUserId(user.user_id);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {language === 'th' ? 'แก้ไขผู้ใช้' : 'Edit User'}
            </DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                {loadingEmail ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground text-sm">
                      {language === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                    </span>
                  </div>
                ) : (
                  <Input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, email: e.target.value })
                    }
                    placeholder="user@example.com"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('fullName')}</Label>
                <Input
                  value={editingUser.full_name || ''}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, full_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'th' ? 'บทบาท' : 'Role'}</Label>
                {editingUser.role === 'admin' ? (
                  <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
                    <span className="text-muted-foreground">
                      {t('admin')} {language === 'th' ? '(ไม่สามารถเปลี่ยนได้)' : '(cannot change)'}
                    </span>
                  </div>
                ) : (
                  <Select
                    value={editingUser.role || ''}
                    onValueChange={(value: AppRole) =>
                      setEditingUser({ ...editingUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'th' ? 'เลือกบทบาท' : 'Select role'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">{t('executive')}</SelectItem>
                      <SelectItem value="supervisor">{t('supervisor')}</SelectItem>
                      <SelectItem value="staff">{t('staff')}</SelectItem>
                      <SelectItem value="guest">{t('guest')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('company')}</Label>
                <Select
                  value={editingUser.company_id || ''}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, company_id: value, site_id: null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกบริษัท' : 'Select company'} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.company_id} value={c.company_id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('site')}</Label>
                <Select
                  value={editingUser.site_id || ''}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, site_id: value })
                  }
                  disabled={!editingUser.company_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกสถานที่' : 'Select site'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSites.map((s) => (
                      <SelectItem key={s.site_id} value={s.site_id}>
                        {s.site_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isManager && (
                <div className="flex items-center justify-between">
                  <Label>{language === 'th' ? 'สถานะใช้งาน' : 'Active Status'}</Label>
                  <Switch
                    checked={editingUser.is_active}
                    disabled={editingUser.role === 'admin'}
                    onCheckedChange={(checked) =>
                      setEditingUser({ ...editingUser, is_active: checked })
                    }
                  />
                </div>
              )}
              <Button onClick={handleEditUser} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">
              {language === 'th' ? 'ยืนยันการลบผู้ใช้' : 'Confirm Delete User'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {language === 'th' 
                ? 'คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้? การกระทำนี้ไม่สามารถย้อนกลับได้'
                : 'Are you sure you want to delete this user? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel disabled={deleting} className="w-full sm:w-auto">
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Change Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => {
        setIsPasswordDialogOpen(open);
        if (!open) {
          setPasswordUser(null);
          setNewPassword('');
          setConfirmPassword('');
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
            </DialogTitle>
          </DialogHeader>
          {passwordUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
                  <span className="text-muted-foreground">{passwordUser.email}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === 'th' ? 'รหัสผ่านใหม่' : 'New Password'} *</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'th' ? 'ยืนยันรหัสผ่าน' : 'Confirm Password'} *</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button onClick={handleChangePassword} className="w-full" disabled={changingPassword}>
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {language === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
