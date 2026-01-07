import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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

interface Metric {
  metric_id: string;
  metric_name: string;
  theme_id: string;
  unit: string | null;
}

interface Theme {
  theme_id: string;
  theme_name: string;
}

export default function MetricManagement() {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    metric_id: '',
    metric_name: '',
    theme_id: '',
    unit: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [metricsRes, themesRes] = await Promise.all([
        supabase.from('esg_metric').select('*').order('metric_name'),
        supabase.from('esg_theme').select('theme_id, theme_name'),
      ]);

      setMetrics(metricsRes.data || []);
      setThemes(themesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.metric_id || !formData.metric_name || !formData.theme_id) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all required fields',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingMetric) {
        const { error } = await supabase
          .from('esg_metric')
          .update({
            metric_name: formData.metric_name,
            theme_id: formData.theme_id,
            unit: formData.unit || null,
          })
          .eq('metric_id', editingMetric.metric_id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('esg_metric').insert({
          metric_id: formData.metric_id,
          metric_name: formData.metric_name,
          theme_id: formData.theme_id,
          unit: formData.unit || null,
        });

        if (error) throw error;
      }

      toast({
        title: t('success'),
        description: language === 'th' ? 'บันทึกข้อมูลสำเร็จ' : 'Data saved successfully',
      });

      setIsDialogOpen(false);
      resetForm();
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

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase.from('esg_metric').delete().eq('metric_id', deleteId);
      if (error) throw error;

      toast({
        title: t('success'),
        description: language === 'th' ? 'ลบข้อมูลสำเร็จ' : 'Data deleted successfully',
      });

      fetchData();
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
    setFormData({ metric_id: '', metric_name: '', theme_id: '', unit: '' });
    setEditingMetric(null);
  };

  const openEditDialog = (metric: Metric) => {
    setEditingMetric(metric);
    setFormData({
      metric_id: metric.metric_id,
      metric_name: metric.metric_name,
      theme_id: metric.theme_id,
      unit: metric.unit || '',
    });
    setIsDialogOpen(true);
  };

  const filteredMetrics = metrics.filter(
    (m) =>
      m.metric_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.metric_id.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-2xl font-bold text-foreground">{t('metrics')}</h1>
            <p className="text-muted-foreground">
              {language === 'th' ? 'จัดการข้อมูลตัวชี้วัด ESG' : 'Manage ESG metric data'}
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
                  {editingMetric
                    ? language === 'th'
                      ? 'แก้ไขตัวชี้วัด ESG'
                      : 'Edit ESG Metric'
                    : language === 'th'
                    ? 'เพิ่มตัวชี้วัด ESG'
                    : 'Add ESG Metric'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('metricId')} *</Label>
                  <Input
                    value={formData.metric_id}
                    onChange={(e) => setFormData({ ...formData, metric_id: e.target.value })}
                    disabled={!!editingMetric}
                    placeholder="e.g., E01-01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('metricName')} *</Label>
                  <Input
                    value={formData.metric_name}
                    onChange={(e) => setFormData({ ...formData, metric_name: e.target.value })}
                    placeholder={language === 'th' ? 'เช่น ปริมาณการใช้ไฟฟ้า' : 'e.g., Electricity Consumption'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('theme')} *</Label>
                  <Select
                    value={formData.theme_id}
                    onValueChange={(value) => setFormData({ ...formData, theme_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'th' ? 'เลือกหัวข้อ' : 'Select theme'} />
                    </SelectTrigger>
                    <SelectContent>
                      {themes.map((t) => (
                        <SelectItem key={t.theme_id} value={t.theme_id}>
                          {t.theme_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('unit')}</Label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder={language === 'th' ? 'เช่น kWh, tCO2e' : 'e.g., kWh, tCO2e'}
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
                  <TableHead>{t('metricId')}</TableHead>
                  <TableHead>{t('metricName')}</TableHead>
                  <TableHead>{t('theme')}</TableHead>
                  <TableHead>{t('unit')}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMetrics.map((metric) => (
                    <TableRow key={metric.metric_id}>
                      <TableCell className="font-mono text-sm">{metric.metric_id}</TableCell>
                      <TableCell className="font-medium">{metric.metric_name}</TableCell>
                      <TableCell>
                        {themes.find((t) => t.theme_id === metric.theme_id)?.theme_name || '-'}
                      </TableCell>
                      <TableCell>{metric.unit || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(metric)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(metric.metric_id)}
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
