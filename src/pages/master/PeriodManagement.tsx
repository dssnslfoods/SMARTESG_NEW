import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Search, Trash2 } from 'lucide-react';
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

interface Period {
  period_id: string;
  year: number;
  month: number;
  month_name: string;
}

const monthNames: Record<number, { th: string; en: string }> = {
  1: { th: 'มกราคม', en: 'January' },
  2: { th: 'กุมภาพันธ์', en: 'February' },
  3: { th: 'มีนาคม', en: 'March' },
  4: { th: 'เมษายน', en: 'April' },
  5: { th: 'พฤษภาคม', en: 'May' },
  6: { th: 'มิถุนายน', en: 'June' },
  7: { th: 'กรกฎาคม', en: 'July' },
  8: { th: 'สิงหาคม', en: 'August' },
  9: { th: 'กันยายน', en: 'September' },
  10: { th: 'ตุลาคม', en: 'October' },
  11: { th: 'พฤศจิกายน', en: 'November' },
  12: { th: 'ธันวาคม', en: 'December' },
};

export default function PeriodManagement() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { logActivity } = useAuditLog();

  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    period_id: '',
    year: new Date().getFullYear(),
    month: 1,
    month_name: monthNames[1][language === 'th' ? 'th' : 'en'],
  });

  const handleMonthChange = (month: number) => {
    const validMonth = Math.min(12, Math.max(1, month));
    setFormData({
      ...formData,
      month: validMonth,
      month_name: monthNames[validMonth]?.[language === 'th' ? 'th' : 'en'] || '',
    });
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('reporting_period')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
    } catch (error) {
      console.error('Error fetching periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.period_id || !formData.month_name) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all required fields',
      });
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        year: formData.year,
        month: formData.month,
        month_name: formData.month_name,
      };

      if (editingPeriod) {
        const { error } = await supabase
          .from('reporting_period')
          .update(dataToSave)
          .eq('period_id', editingPeriod.period_id);

        if (error) throw error;

        await logActivity({
          action: 'UPDATE',
          entityType: 'reporting_period',
          entityId: editingPeriod.period_id,
          beforeData: editingPeriod,
          afterData: { ...dataToSave, period_id: editingPeriod.period_id },
        });
      } else {
        const insertData = { ...dataToSave, period_id: formData.period_id };
        const { error } = await supabase.from('reporting_period').insert(insertData);

        if (error) throw error;

        await logActivity({
          action: 'CREATE',
          entityType: 'reporting_period',
          entityId: formData.period_id,
          afterData: insertData,
        });
      }

      toast({
        title: t('success'),
        description: language === 'th' ? 'บันทึกข้อมูลสำเร็จ' : 'Data saved successfully',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchPeriods();
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

  const handleDelete = async () => {
    if (!deleteId) return;

    const periodToDelete = periods.find(p => p.period_id === deleteId);

    try {
      const { error } = await supabase.from('reporting_period').delete().eq('period_id', deleteId);
      if (error) throw error;

      await logActivity({
        action: 'DELETE',
        entityType: 'reporting_period',
        entityId: deleteId,
        beforeData: periodToDelete,
      });

      toast({
        title: t('success'),
        description: language === 'th' ? 'ลบข้อมูลสำเร็จ' : 'Data deleted successfully',
      });

      fetchPeriods();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message,
      });
    } finally {
      setDeleteId(null);
    }
  };

  const resetForm = () => {
    setFormData({ period_id: '', year: new Date().getFullYear(), month: 1, month_name: '' });
    setEditingPeriod(null);
  };

  const openEditDialog = (period: Period) => {
    setEditingPeriod(period);
    setFormData({
      period_id: period.period_id,
      year: period.year,
      month: period.month,
      month_name: period.month_name,
    });
    setIsDialogOpen(true);
  };

  const filteredPeriods = periods.filter(
    (p) =>
      p.month_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.period_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.year.toString().includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('reportingPeriods')}</h1>
            <p className="text-muted-foreground">
              {language === 'th' ? 'จัดการข้อมูลรอบระยะเวลา' : 'Manage reporting period data'}
            </p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t('add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPeriod
                    ? language === 'th'
                      ? 'แก้ไขรอบระยะเวลา'
                      : 'Edit Period'
                    : language === 'th'
                    ? 'เพิ่มรอบระยะเวลา'
                    : 'Add Period'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('periodId')} *</Label>
                  <Input
                    value={formData.period_id}
                    onChange={(e) => setFormData({ ...formData, period_id: e.target.value })}
                    disabled={!!editingPeriod}
                    placeholder="e.g., 2024-01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('year')} *</Label>
                  <Input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 2024 })}
                    min={2020}
                    max={2100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('month')} *</Label>
                  <Input
                    type="number"
                    value={formData.month}
                    onChange={(e) => handleMonthChange(parseInt(e.target.value) || 1)}
                    min={1}
                    max={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('monthName')} *</Label>
                  <Input
                    value={formData.month_name}
                    onChange={(e) => setFormData({ ...formData, month_name: e.target.value })}
                    placeholder={language === 'th' ? 'เช่น มกราคม' : 'e.g., January'}
                  />
                </div>
                <Button onClick={handleSave} className="w-full" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('periodId')}</TableHead>
                  <TableHead>{t('year')}</TableHead>
                  <TableHead>{t('month')}</TableHead>
                  <TableHead>{t('monthName')}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeriods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPeriods.map((period) => (
                    <TableRow key={period.period_id}>
                      <TableCell className="font-mono text-sm">{period.period_id}</TableCell>
                      <TableCell>{period.year}</TableCell>
                      <TableCell>{period.month}</TableCell>
                      <TableCell>{period.month_name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(period)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(period.period_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {language === 'th'
                  ? 'การลบข้อมูลนี้ไม่สามารถย้อนกลับได้'
                  : 'This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
