import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Plus,
  Pencil,
  Loader2,
  ShieldCheck,
  Crown,
  Sparkles,
  Globe2,
  Mail,
  Palette,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Plan = 'trial' | 'standard' | 'enterprise';

interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  plan: Plan;
  is_active: boolean;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

interface TenantForm {
  name: string;
  slug: string;
  plan: Plan;
  contact_email: string;
  primary_color: string;
  logo_url: string;
  is_active: boolean;
}

const PLAN_STYLES: Record<Plan, { label: string; labelTh: string; color: string }> = {
  trial: {
    label: 'Trial',
    labelTh: 'ทดลอง',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  standard: {
    label: 'Standard',
    labelTh: 'มาตรฐาน',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  enterprise: {
    label: 'Enterprise',
    labelTh: 'องค์กรขนาดใหญ่',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
};

const emptyForm: TenantForm = {
  name: '',
  slug: '',
  plan: 'trial',
  contact_email: '',
  primary_color: '#10b981',
  logo_url: '',
  is_active: true,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function TenantManagement() {
  const { language } = useLanguage();
  const { isSuperAdmin, user } = useAuth();
  const { toast } = useToast();
  const th = language === 'th';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchTenants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant')
        .select('*')
        .order('created_at');
      if (error) throw error;
      setTenants((data ?? []) as Tenant[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchTenants();
  }, [isSuperAdmin]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingTenant(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: Tenant) => {
    setEditingTenant(t);
    setForm({
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      contact_email: t.contact_email ?? '',
      primary_color: t.primary_color ?? '#10b981',
      logo_url: t.logo_url ?? '',
      is_active: t.is_active,
    });
    setDialogOpen(true);
  };

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 64);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        variant: 'destructive',
        title: th ? 'ข้อผิดพลาด' : 'Error',
        description: th ? 'กรุณากรอกชื่อ Tenant' : 'Tenant name is required',
      });
      return;
    }
    const slug = form.slug.trim() || slugify(form.name);
    if (!slug) {
      toast({
        variant: 'destructive',
        title: th ? 'ข้อผิดพลาด' : 'Error',
        description: th ? 'Slug ไม่ถูกต้อง' : 'Invalid slug',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug,
        plan: form.plan,
        contact_email: form.contact_email.trim() || null,
        primary_color: form.primary_color || '#10b981',
        logo_url: form.logo_url.trim() || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingTenant) {
        const { error } = await supabase
          .from('tenant')
          .update(payload)
          .eq('tenant_id', editingTenant.tenant_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenant').insert(payload);
        if (error) throw error;
      }

      toast({
        title: th ? 'สำเร็จ' : 'Success',
        description: th
          ? editingTenant
            ? 'อัปเดต tenant สำเร็จ'
            : 'สร้าง tenant สำเร็จ'
          : editingTenant
            ? 'Tenant updated'
            : 'Tenant created',
      });
      setDialogOpen(false);
      await fetchTenants();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: th ? 'ข้อผิดพลาด' : 'Error',
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: Tenant) => {
    setTogglingId(t.tenant_id);
    try {
      const { error } = await supabase
        .from('tenant')
        .update({ is_active: !t.is_active })
        .eq('tenant_id', t.tenant_id);
      if (error) throw error;
      await fetchTenants();
      toast({
        title: th ? 'สำเร็จ' : 'Success',
        description: th
          ? !t.is_active
            ? 'เปิดใช้งาน tenant แล้ว'
            : 'ปิดใช้งาน tenant แล้ว'
          : !t.is_active
            ? 'Tenant activated'
            : 'Tenant deactivated',
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setTogglingId(null);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.is_active).length;
    const byPlan: Record<Plan, number> = { trial: 0, standard: 0, enterprise: 0 };
    tenants.forEach((t) => (byPlan[t.plan] = (byPlan[t.plan] ?? 0) + 1));
    return { total: tenants.length, active, byPlan };
  }, [tenants]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <ShieldCheck className="h-12 w-12 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold text-foreground">
          {th ? 'เฉพาะ Super Admin เท่านั้น' : 'Super Admin Only'}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {th
            ? 'หน้านี้ใช้สำหรับจัดการลูกค้า (Tenants) ของแพลตฟอร์ม ESG Smart Performance — สงวนสำหรับผู้ดูแลระบบกลาง'
            : 'This page manages platform tenants. Access is restricted to platform super administrators.'}
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            {th ? 'จัดการลูกค้า (Tenants)' : 'Tenant Management'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">
            {th
              ? 'จัดการบริษัทลูกค้าทั้งหมดของแพลตฟอร์ม ESG Smart Performance — สร้างลูกค้าใหม่ ปรับ plan ปิด/เปิดการใช้งาน'
              : 'Manage all customer tenants on the ESG Smart Performance platform — create new customers, adjust plans, activate/deactivate'}
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shrink-0"
        >
          <Plus className="h-4 w-4" />
          {th ? 'สร้าง Tenant ใหม่' : 'New Tenant'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: th ? 'Tenants ทั้งหมด' : 'Total Tenants',
            value: stats.total,
            icon: Building2,
            color: 'text-foreground',
          },
          {
            label: th ? 'ใช้งาน' : 'Active',
            value: stats.active,
            icon: CheckCircle2,
            color: 'text-emerald-600',
          },
          {
            label: 'Standard / Trial',
            value: stats.byPlan.standard + stats.byPlan.trial,
            icon: Sparkles,
            color: 'text-blue-600',
          },
          {
            label: 'Enterprise',
            value: stats.byPlan.enterprise,
            icon: Crown,
            color: 'text-purple-600',
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="glass-card-solid">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                  <Icon className={`h-7 w-7 opacity-50 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card className="glass-card-solid">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-emerald-600" />
            {th ? 'รายการ Tenants' : 'All Tenants'}
          </CardTitle>
          <CardDescription>
            {th
              ? 'รายการบริษัทลูกค้าทั้งหมด แสดง plan สถานะ และข้อมูลการติดต่อ'
              : 'All platform customers with plan, status and contact info'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs">{th ? 'ชื่อ' : 'Name'}</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Slug</TableHead>
                    <TableHead className="text-xs w-28">Plan</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">
                      {th ? 'อีเมล' : 'Contact'}
                    </TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">
                      {th ? 'สี Brand' : 'Brand'}
                    </TableHead>
                    <TableHead className="text-xs w-24 text-center">
                      {th ? 'ใช้งาน' : 'Active'}
                    </TableHead>
                    <TableHead className="text-xs w-20 text-right">
                      {th ? 'จัดการ' : 'Actions'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground text-sm py-8"
                      >
                        {th ? 'ยังไม่มี Tenant' : 'No tenants yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((t) => {
                      const planStyle = PLAN_STYLES[t.plan];
                      return (
                        <TableRow key={t.tenant_id}>
                          <TableCell className="text-sm font-semibold py-2.5">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: t.primary_color ?? '#10b981' }}
                              >
                                {t.name.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span>{t.name}</span>
                                <span className="text-[10px] text-muted-foreground sm:hidden font-mono">
                                  {t.slug}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono hidden sm:table-cell">
                            {t.slug}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${planStyle.color}`}>
                              {th ? planStyle.labelTh : planStyle.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                            {t.contact_email ? (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {t.contact_email}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="h-4 w-4 rounded-full border border-border"
                                style={{ backgroundColor: t.primary_color ?? '#10b981' }}
                              />
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {t.primary_color ?? '#10b981'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={t.is_active}
                                disabled={togglingId === t.tenant_id}
                                onCheckedChange={() => handleToggleActive(t)}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card-solid max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-600" />
              {editingTenant
                ? th
                  ? 'แก้ไข Tenant'
                  : 'Edit Tenant'
                : th
                  ? 'สร้าง Tenant ใหม่'
                  : 'New Tenant'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                {th ? 'ชื่อบริษัท' : 'Company / Tenant Name'} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: editingTenant ? f.slug : slugify(e.target.value),
                  }))
                }
                placeholder="Acme Foods PCL"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Slug <span className="text-muted-foreground text-xs">(URL identifier)</span>
              </Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="acme-foods"
                className="font-mono"
                disabled={!!editingTenant}
              />
              <p className="text-[10px] text-muted-foreground">
                {editingTenant
                  ? th
                    ? '⚠️ ไม่สามารถเปลี่ยน slug หลังสร้างแล้ว'
                    : '⚠️ Slug cannot be changed after creation'
                  : th
                    ? `จะใช้เป็น subdomain ในอนาคต: ${form.slug || 'acme-foods'}.smartesg.app`
                    : `Will be used as subdomain: ${form.slug || 'acme-foods'}.smartesg.app`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select
                value={form.plan}
                onValueChange={(v: Plan) => setForm((f) => ({ ...f, plan: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['trial', 'standard', 'enterprise'] as Plan[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            p === 'enterprise'
                              ? 'bg-purple-500'
                              : p === 'standard'
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                          }`}
                        />
                        {th ? PLAN_STYLES[p].labelTh : PLAN_STYLES[p].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {th ? 'อีเมลติดต่อ' : 'Contact Email'}
              </Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="admin@acme-foods.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                {th ? 'สี Brand หลัก' : 'Primary Brand Color'}
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                  className="h-10 w-16 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={form.primary_color}
                  onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                  placeholder="#10b981"
                  className="font-mono flex-1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{th ? 'Logo URL' : 'Logo URL'}</Label>
              <Input
                value={form.logo_url}
                onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <Label className="flex items-center gap-1.5 cursor-pointer">
                {form.is_active ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                {th ? 'เปิดใช้งาน' : 'Active'}
              </Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                {th ? 'ยกเลิก' : 'Cancel'}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {th ? 'บันทึก' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
