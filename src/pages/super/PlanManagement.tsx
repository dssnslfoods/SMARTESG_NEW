import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { MainLayout as Layout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Save, Zap, Star, Building2, Infinity } from 'lucide-react';

interface PlanLimits {
  plan: 'trial' | 'standard' | 'enterprise';
  max_users: number;
  max_sites: number;
  max_companies: number;
  max_metrics: number;
  allow_whitelabel: boolean;
  allow_export: boolean;
  allow_audit_log: boolean;
  description: string | null;
}

const PLAN_META = {
  trial: {
    icon: Zap,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    badge: 'bg-blue-500',
  },
  standard: {
    icon: Star,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    badge: 'bg-emerald-500',
  },
  enterprise: {
    icon: Building2,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    badge: 'bg-purple-500',
  },
} as const;

export default function PlanManagement() {
  const { language } = useLanguage();
  const th = language === 'th';
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: plans = [], isLoading } = useQuery<PlanLimits[]>({
    queryKey: ['plan-limits-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_limits')
        .select('*')
        .order('plan');
      if (error) throw error;
      return (data ?? []) as PlanLimits[];
    },
  });

  const [edits, setEdits] = useState<Record<string, Partial<PlanLimits>>>({});

  function getVal<K extends keyof PlanLimits>(plan: string, key: K, original: PlanLimits[K]): PlanLimits[K] {
    return (edits[plan]?.[key] ?? original) as PlanLimits[K];
  }

  function setField(plan: string, key: keyof PlanLimits, value: unknown) {
    setEdits(prev => ({
      ...prev,
      [plan]: { ...prev[plan], [key]: value },
    }));
  }

  const saveMutation = useMutation({
    mutationFn: async ({ plan, values }: { plan: string; values: Partial<PlanLimits> }) => {
      const { error } = await supabase
        .from('plan_limits')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('plan', plan);
      if (error) throw error;
    },
    onSuccess: (_, { plan }) => {
      toast({ title: th ? 'บันทึกสำเร็จ' : 'Saved', description: `Plan "${plan}" updated` });
      setEdits(prev => { const n = { ...prev }; delete n[plan]; return n; });
      qc.invalidateQueries({ queryKey: ['plan-limits-admin'] });
      qc.invalidateQueries({ queryKey: ['plan-limits'] });
    },
    onError: (e: Error) => {
      toast({ title: th ? 'เกิดข้อผิดพลาด' : 'Error', description: e.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-gray-400">
          {th ? 'กำลังโหลด...' : 'Loading...'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {th ? 'จัดการแพ็กเกจ (Plan Management)' : 'Plan Management'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {th
              ? 'กำหนดขีดจำกัดและสิทธิ์สำหรับแต่ละ Plan Tier'
              : 'Configure limits and features for each plan tier'}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {(['trial', 'standard', 'enterprise'] as const).map(planKey => {
            const plan = plans.find(p => p.plan === planKey);
            if (!plan) return null;

            const meta = PLAN_META[planKey];
            const Icon = meta.icon;
            const isDirty = !!edits[planKey];

            return (
              <Card key={planKey} className={`border-2 ${isDirty ? 'border-amber-400' : 'border-transparent'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg p-2 ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base capitalize">{planKey}</CardTitle>
                    </div>
                    {isDirty && (
                      <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">
                        {th ? 'มีการแก้ไข' : 'Unsaved'}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    <Input
                      value={getVal(planKey, 'description', plan.description) ?? ''}
                      onChange={e => setField(planKey, 'description', e.target.value)}
                      placeholder={th ? 'คำอธิบาย...' : 'Description...'}
                      className="mt-1 h-7 text-xs"
                    />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Numeric limits */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {th ? 'ขีดจำกัด' : 'Limits'}
                    </p>

                    {([
                      { key: 'max_users',     label: th ? 'ผู้ใช้งาน' : 'Users' },
                      { key: 'max_sites',     label: th ? 'สถานที่' : 'Sites' },
                      { key: 'max_companies', label: th ? 'บริษัท' : 'Companies' },
                      { key: 'max_metrics',   label: th ? 'ตัวชี้วัด' : 'Metrics' },
                    ] as { key: keyof PlanLimits; label: string }[]).map(({ key, label }) => {
                      const val = getVal(planKey, key, plan[key]) as number;
                      const isUnlimited = val === -1;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <Label className="w-24 shrink-0 text-xs text-gray-600">{label}</Label>
                          <div className="flex flex-1 items-center gap-1">
                            {isUnlimited ? (
                              <div className="flex flex-1 items-center gap-1 rounded border border-purple-200 bg-purple-50 px-2 py-1">
                                <Infinity className="h-3 w-3 text-purple-500" />
                                <span className="text-xs text-purple-600">
                                  {th ? 'ไม่จำกัด' : 'Unlimited'}
                                </span>
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min={1}
                                value={val}
                                onChange={e => setField(planKey, key, parseInt(e.target.value) || 1)}
                                className="h-7 flex-1 text-xs"
                              />
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              title={isUnlimited ? (th ? 'ตั้งค่าตัวเลข' : 'Set number') : (th ? 'ไม่จำกัด' : 'Set unlimited')}
                              onClick={() => setField(planKey, key, isUnlimited ? 10 : -1)}
                            >
                              <Infinity className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  {/* Feature toggles */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {th ? 'ฟีเจอร์' : 'Features'}
                    </p>

                    {([
                      { key: 'allow_export',     label: th ? 'ส่งออกรายงาน' : 'Export Reports' },
                      { key: 'allow_audit_log',  label: 'Audit Log' },
                      { key: 'allow_whitelabel', label: 'White-label' },
                    ] as { key: keyof PlanLimits; label: string }[]).map(({ key, label }) => {
                      const val = getVal(planKey, key, plan[key]) as boolean;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="text-xs text-gray-600">{label}</Label>
                          <Switch
                            checked={val}
                            onCheckedChange={v => setField(planKey, key, v)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Trial duration note */}
                  {planKey === 'trial' && (
                    <>
                      <Separator />
                      <p className="text-xs text-blue-600">
                        {th
                          ? '⏱ ระยะเวลา Trial: 30 วันนับจากวันที่สร้าง Tenant'
                          : '⏱ Trial duration: 30 days from tenant creation'}
                      </p>
                    </>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!isDirty || saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ plan: planKey, values: edits[planKey] })}
                  >
                    <Save className="mr-2 h-3.5 w-3.5" />
                    {th ? 'บันทึก' : 'Save'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tenant plan overview table */}
        <TenantPlanOverview th={th} />
      </div>
    </Layout>
  );
}

// ── Tenant overview ──────────────────────────────────────────────────────────

interface TenantRow {
  tenant_id: string;
  name: string;
  plan: string;
  is_active: boolean;
  trial_ends_at: string | null;
  is_trial_expired: boolean;
  created_at: string;
}

function TenantPlanOverview({ th }: { th: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tenants = [] } = useQuery<TenantRow[]>({
    queryKey: ['tenants-plan-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant')
        .select('tenant_id, name, plan, is_active, trial_ends_at, is_trial_expired, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantRow[];
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async ({ tenant_id, plan }: { tenant_id: string; plan: string }) => {
      const { error } = await supabase
        .from('tenant')
        .update({ plan, is_trial_expired: false })
        .eq('tenant_id', tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: th ? 'อัพเดทสำเร็จ' : 'Updated' });
      qc.invalidateQueries({ queryKey: ['tenants-plan-overview'] });
    },
  });

  const PLAN_BADGE: Record<string, string> = {
    trial:      'bg-blue-100 text-blue-700',
    standard:   'bg-emerald-100 text-emerald-700',
    enterprise: 'bg-purple-100 text-purple-700',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {th ? 'สถานะ Plan ของ Tenant ทั้งหมด' : 'Tenant Plan Status'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 font-medium">{th ? 'ชื่อ' : 'Name'}</th>
                <th className="pb-2 font-medium">Plan</th>
                <th className="pb-2 font-medium">{th ? 'สถานะ' : 'Status'}</th>
                <th className="pb-2 font-medium">{th ? 'Trial หมดอายุ' : 'Trial Ends'}</th>
                <th className="pb-2 font-medium">{th ? 'จัดการ' : 'Manage'}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map(t => {
                const trialExpired = t.is_trial_expired ||
                  (t.plan === 'trial' && t.trial_ends_at && new Date(t.trial_ends_at) < new Date());
                return (
                  <tr key={t.tenant_id} className="text-gray-700">
                    <td className="py-2 font-medium">{t.name}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_BADGE[t.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="py-2">
                      {!t.is_active ? (
                        <span className="text-xs text-gray-400">{th ? 'ปิดใช้งาน' : 'Inactive'}</span>
                      ) : trialExpired ? (
                        <span className="text-xs font-medium text-red-600">{th ? 'Trial หมดอายุ' : 'Trial Expired'}</span>
                      ) : (
                        <span className="text-xs text-emerald-600">{th ? 'ใช้งานอยู่' : 'Active'}</span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {t.plan === 'trial' && t.trial_ends_at
                        ? new Date(t.trial_ends_at).toLocaleDateString(th ? 'th-TH' : 'en-US')
                        : '—'}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        {(['trial', 'standard', 'enterprise'] as const)
                          .filter(p => p !== t.plan)
                          .map(p => (
                            <Button
                              key={p}
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => upgradeMutation.mutate({ tenant_id: t.tenant_id, plan: p })}
                            >
                              → {p}
                            </Button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
