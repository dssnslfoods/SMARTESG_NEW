import { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Search, UserPlus, Trash2, KeyRound, ShieldCheck, X as XIcon } from 'lucide-react';
import { UserManagementLoadingSkeleton } from '@/components/ui/loading-skeleton';

type AppRole = 'admin' | 'executive' | 'supervisor' | 'staff' | 'guest' | 'super_admin';

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
  super_admin: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
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

  // Multi-select + bulk reset password
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkPasswordOpen, setIsBulkPasswordOpen] = useState(false);
  const [bulkPasswordMode, setBulkPasswordMode] = useState<'shared' | 'random'>('shared');
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<
    { email: string; full_name: string; password: string; ok: boolean; error?: string }[]
  >([]);

  // Check if current user is admin or supervisor (can manage others)
  const isManager =
    currentUserRole === 'admin' ||
    currentUserRole === 'supervisor' ||
    currentUserRole === 'super_admin';
  // Check if current user is staff or executive (can only manage self)
  const isSelfOnly = currentUserRole === 'executive' || currentUserRole === 'staff';

  const handleRefresh = useCallback(async () => {
    await fetchData();
  }, []);

  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

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

  // ---- Multi-select helpers ----
  const toggleSelectOne = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[], checked: boolean) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (checked) ids.forEach(id => next.add(id));
      else ids.forEach(id => next.delete(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedUserIds(new Set());

  const generateTempPassword = (length = 12) => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const nums = '23456789';
    const all = upper + lower + nums;
    // Guarantee at least 1 of each class
    const pick = (src: string) => src[Math.floor(Math.random() * src.length)];
    let pwd = pick(upper) + pick(lower) + pick(nums);
    for (let i = pwd.length; i < length; i++) pwd += pick(all);
    // Shuffle
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  };

  const openBulkPasswordDialog = () => {
    setBulkPasswordMode('shared');
    setBulkPassword('');
    setBulkConfirm('');
    setBulkResults([]);
    setIsBulkPasswordOpen(true);
  };

  const handleBulkResetPassword = async () => {
    const targets = users.filter(u => selectedUserIds.has(u.user_id));
    if (targets.length === 0) return;

    if (bulkPasswordMode === 'shared') {
      if (!bulkPassword || bulkPassword.length < 6) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: language === 'th' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Password must be at least 6 characters',
        });
        return;
      }
      if (bulkPassword !== bulkConfirm) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: language === 'th' ? 'รหัสผ่านไม่ตรงกัน' : 'Passwords do not match',
        });
        return;
      }
    }

    setBulkProcessing(true);
    const results: typeof bulkResults = [];

    for (const u of targets) {
      const pwd = bulkPasswordMode === 'shared' ? bulkPassword : generateTempPassword();
      try {
        // Use userId so we don't depend on email being pre-loaded
        const { data, error } = await supabase.functions.invoke('update-password', {
          body: { userId: u.user_id, newPassword: pwd },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        // Try to grab the email returned (if any) for the result table
        results.push({
          email: u.email || (data?.email as string) || '',
          full_name: u.full_name || '',
          password: pwd,
          ok: true,
        });
      } catch (err: any) {
        results.push({
          email: u.email || '',
          full_name: u.full_name || '',
          password: pwd,
          ok: false,
          error: err?.message || 'unknown',
        });
      }
    }

    setBulkResults(results);
    setBulkProcessing(false);

    const okCount = results.filter(r => r.ok).length;
    toast({
      title: t('success'),
      description: language === 'th'
        ? `รีเซ็ตรหัสผ่านสำเร็จ ${okCount}/${targets.length} คน`
        : `Password reset done ${okCount}/${targets.length} users`,
    });
  };

  const copyResultsToClipboard = async () => {
    const lines = bulkResults.map(r =>
      `${r.full_name}\t${r.email}\t${r.password}\t${r.ok ? 'OK' : 'FAIL: ' + (r.error ?? '')}`,
    );
    const header = ['Full Name', 'Email', 'Temp Password', 'Status'].join('\t');
    await navigator.clipboard.writeText([header, ...lines].join('\n'));
    toast({
      title: t('success'),
      description: language === 'th' ? 'คัดลอกไปยังคลิปบอร์ดแล้ว' : 'Copied to clipboard',
    });
  };

  const downloadResultsCsv = () => {
    const escape = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const header = ['Full Name', 'Email', 'Temp Password', 'Status'].map(escape).join(',');
    const rows = bulkResults.map(r =>
      [r.full_name, r.email, r.password, r.ok ? 'OK' : `FAIL: ${r.error ?? ''}`].map(escape).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `password_reset_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    return <UserManagementLoadingSkeleton />;
  }

  return (
    <div 
      ref={containerRef}
      className="space-y-4 sm:space-y-6 h-full overflow-y-auto"
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      
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
            <DialogContent className="glass-card-solid max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
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
                    {currentUserRole === 'super_admin' && (
                      <SelectItem value="super_admin">
                        👑 {language === 'th' ? 'ผู้ดูแลแพลตฟอร์ม' : 'Super Admin'}
                      </SelectItem>
                    )}
                    {(currentUserRole === 'admin' || currentUserRole === 'super_admin') && (
                      <SelectItem value="admin">{t('admin')}</SelectItem>
                    )}
                    {(currentUserRole === 'admin' || currentUserRole === 'super_admin') && (
                      <SelectItem value="executive">{t('executive')}</SelectItem>
                    )}
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

      <Card className="glass-card-solid">
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

          {/* Bulk action bar — visible when user(s) selected */}
          {isManager && selectedUserIds.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2">
              <Badge variant="secondary" className="bg-emerald-600 text-white hover:bg-emerald-700">
                {language === 'th'
                  ? `เลือก ${selectedUserIds.size} คน`
                  : `${selectedUserIds.size} selected`}
              </Badge>
              <span className="text-xs text-emerald-900/70 hidden sm:inline">
                {language === 'th' ? '— เลือกการดำเนินการ:' : '— Choose action:'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearSelection}
                  className="gap-1 border-emerald-200"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  {language === 'th' ? 'ยกเลิก' : 'Clear'}
                </Button>
                <Button
                  size="sm"
                  onClick={openBulkPasswordDialog}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {language === 'th' ? 'รีเซ็ตรหัสผ่าน' : 'Reset Password'}
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {isManager && (() => {
                    const selectableIds = filteredUsers
                      .filter(u => u.role !== 'admin')
                      .map(u => u.user_id);
                    const allSelected =
                      selectableIds.length > 0 && selectableIds.every(id => selectedUserIds.has(id));
                    const someSelected =
                      selectableIds.some(id => selectedUserIds.has(id)) && !allSelected;
                    return (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                          onCheckedChange={(c) => toggleSelectAll(selectableIds, !!c)}
                          aria-label={language === 'th' ? 'เลือกทั้งหมด' : 'Select all'}
                        />
                      </TableHead>
                    );
                  })()}
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
                    <TableCell colSpan={isManager ? 7 : 6} className="text-center text-muted-foreground text-sm">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.user_id}
                      className={selectedUserIds.has(user.user_id) ? 'bg-emerald-50/60' : ''}
                    >
                      {isManager && (
                        <TableCell className="w-10 py-2 sm:py-4">
                          {user.role === 'admin' ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            <Checkbox
                              checked={selectedUserIds.has(user.user_id)}
                              onCheckedChange={() => toggleSelectOne(user.user_id)}
                              aria-label={`Select ${user.full_name}`}
                            />
                          )}
                        </TableCell>
                      )}
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
                          {/* Password change button — admin/supervisor can reset others (not admin row); anyone can reset their own */}
                          {((isManager && user.role !== 'admin') || user.user_id === currentUser?.id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                              title={language === 'th' ? 'รีเซ็ตรหัสผ่าน' : 'Reset password'}
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
                          )}
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
        <DialogContent className="glass-card-solid max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
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
                      {currentUserRole === 'super_admin' && (
                        <>
                          <SelectItem value="super_admin">
                            👑 {language === 'th' ? 'ผู้ดูแลแพลตฟอร์ม' : 'Super Admin'}
                          </SelectItem>
                          <SelectItem value="admin">{t('admin')}</SelectItem>
                        </>
                      )}
                      {(currentUserRole === 'admin' || currentUserRole === 'super_admin') && (
                        <SelectItem value="executive">{t('executive')}</SelectItem>
                      )}
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
        <DialogContent className="glass-card-solid max-w-[95vw] sm:max-w-md rounded-3xl">
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

      {/* ===== BULK RESET PASSWORD DIALOG ===== */}
      <Dialog
        open={isBulkPasswordOpen}
        onOpenChange={(open) => {
          if (!open && !bulkProcessing) {
            setIsBulkPasswordOpen(false);
            // Clear results after closing so next open starts fresh
            setTimeout(() => setBulkResults([]), 250);
          }
        }}
      >
        <DialogContent className="glass-card-solid sm:max-w-[640px] max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {language === 'th' ? 'รีเซ็ตรหัสผ่านหลายผู้ใช้' : 'Bulk Reset Password'}
            </DialogTitle>
          </DialogHeader>

          {bulkResults.length === 0 ? (
            <div className="space-y-4 py-2">
              {/* Selected users summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  {language === 'th' ? `ผู้ใช้ที่เลือก (${selectedUserIds.size})` : `Selected users (${selectedUserIds.size})`}
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {users
                    .filter(u => selectedUserIds.has(u.user_id))
                    .map(u => (
                      <Badge key={u.user_id} variant="secondary" className="text-xs font-normal">
                        {u.full_name || u.email || u.user_id}
                      </Badge>
                    ))}
                </div>
              </div>

              {/* Mode selector */}
              <div className="space-y-2">
                <Label>{language === 'th' ? 'วิธีการตั้งรหัส' : 'Password method'}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkPasswordMode('shared')}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      bulkPasswordMode === 'shared'
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">
                      {language === 'th' ? 'รหัสเดียวกันทุกคน' : 'Same password for all'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {language === 'th'
                        ? 'กำหนดรหัสผ่านชุดเดียวให้ทุกผู้ใช้ที่เลือก'
                        : 'Set one shared password for every selected user'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkPasswordMode('random')}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      bulkPasswordMode === 'random'
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">
                      {language === 'th' ? 'สุ่มรหัสแยกแต่ละคน' : 'Unique random per user'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {language === 'th'
                        ? 'สุ่มรหัสผ่าน 12 ตัวอักษรให้แต่ละคน (ปลอดภัยกว่า)'
                        : 'Generate a unique 12-char password per user (more secure)'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Password inputs (shared mode only) */}
              {bulkPasswordMode === 'shared' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{language === 'th' ? 'รหัสผ่านใหม่' : 'New password'} *</Label>
                    <Input
                      type="password"
                      value={bulkPassword}
                      onChange={(e) => setBulkPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={bulkProcessing}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'th' ? 'ยืนยันรหัสผ่าน' : 'Confirm password'} *</Label>
                    <Input
                      type="password"
                      value={bulkConfirm}
                      onChange={(e) => setBulkConfirm(e.target.value)}
                      placeholder="••••••••"
                      disabled={bulkProcessing}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-800">
                  ⚠️{' '}
                  {language === 'th'
                    ? 'รหัสผ่านจะถูกเปลี่ยนทันที — กรุณาแจ้งผู้ใช้และให้เปลี่ยนรหัสใหม่ในการ login ครั้งถัดไป'
                    : 'Passwords will be changed immediately. Notify users and ask them to change their password on next login.'}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setIsBulkPasswordOpen(false)} disabled={bulkProcessing}>
                  {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleBulkResetPassword}
                  disabled={bulkProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {bulkProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {language === 'th'
                    ? `รีเซ็ตรหัสผ่าน (${selectedUserIds.size})`
                    : `Reset Passwords (${selectedUserIds.size})`}
                </Button>
              </div>
            </div>
          ) : (
            /* Results view */
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-sm font-semibold text-emerald-900">
                  ✓{' '}
                  {language === 'th'
                    ? `สำเร็จ ${bulkResults.filter(r => r.ok).length}/${bulkResults.length} คน`
                    : `Done ${bulkResults.filter(r => r.ok).length}/${bulkResults.length}`}
                </p>
                <p className="text-xs text-emerald-800/80 mt-1">
                  {language === 'th'
                    ? 'คัดลอกหรือดาวน์โหลด CSV เพื่อเก็บไว้ส่งให้ผู้ใช้ — รหัสจะไม่แสดงอีกหลังปิด dialog นี้'
                    : 'Copy or download the CSV to share with users — passwords will not be shown again after closing.'}
                </p>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t('fullName')}</TableHead>
                      <TableHead className="text-xs">{t('email')}</TableHead>
                      <TableHead className="text-xs">
                        {language === 'th' ? 'รหัสผ่านชั่วคราว' : 'Temp Password'}
                      </TableHead>
                      <TableHead className="text-xs text-center">
                        {language === 'th' ? 'สถานะ' : 'Status'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResults.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.full_name || '-'}</TableCell>
                        <TableCell className="text-xs">{r.email}</TableCell>
                        <TableCell className="text-xs font-mono">{r.password}</TableCell>
                        <TableCell className="text-xs text-center">
                          {r.ok ? (
                            <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700" title={r.error}>
                              FAIL
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <Button variant="outline" onClick={copyResultsToClipboard}>
                  {language === 'th' ? 'คัดลอกทั้งหมด' : 'Copy all'}
                </Button>
                <Button variant="outline" onClick={downloadResultsCsv}>
                  {language === 'th' ? 'ดาวน์โหลด CSV' : 'Download CSV'}
                </Button>
                <Button
                  onClick={() => {
                    setIsBulkPasswordOpen(false);
                    clearSelection();
                    setTimeout(() => setBulkResults([]), 250);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {language === 'th' ? 'เสร็จสิ้น' : 'Done'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
