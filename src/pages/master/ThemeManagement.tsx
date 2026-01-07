import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
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

interface Theme {
  theme_id: string;
  theme_name: string;
  dimension_id: string;
}

interface Dimension {
  dimension_id: string;
  dimension_name: string;
}

export default function ThemeManagement() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { logActivity } = useAuditLog();

  const [themes, setThemes] = useState<Theme[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    theme_id: '',
    theme_name: '',
    dimension_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [themesRes, dimensionsRes] = await Promise.all([
        supabase.from('esg_theme').select('*').order('theme_name'),
        supabase.from('esg_dimension').select('dimension_id, dimension_name'),
      ]);

      setThemes(themesRes.data || []);
      setDimensions(dimensionsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.theme_id || !formData.theme_name || !formData.dimension_id) {
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
        theme_name: formData.theme_name,
        dimension_id: formData.dimension_id,
      };

      if (editingTheme) {
        const { error } = await supabase
          .from('esg_theme')
          .update(dataToSave)
          .eq('theme_id', editingTheme.theme_id);

        if (error) throw error;

        await logActivity({
          action: 'UPDATE',
          entityType: 'esg_theme',
          entityId: editingTheme.theme_id,
          beforeData: editingTheme,
          afterData: { ...dataToSave, theme_id: editingTheme.theme_id },
        });
      } else {
        const insertData = { ...dataToSave, theme_id: formData.theme_id };
        const { error } = await supabase.from('esg_theme').insert(insertData);

        if (error) throw error;

        await logActivity({
          action: 'CREATE',
          entityType: 'esg_theme',
          entityId: formData.theme_id,
          afterData: insertData,
        });
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

    const themeToDelete = themes.find(t => t.theme_id === deleteId);

    try {
      const { error } = await supabase.from('esg_theme').delete().eq('theme_id', deleteId);
      if (error) throw error;

      await logActivity({
        action: 'DELETE',
        entityType: 'esg_theme',
        entityId: deleteId,
        beforeData: themeToDelete,
      });

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
    setFormData({ theme_id: '', theme_name: '', dimension_id: '' });
    setEditingTheme(null);
  };

  const openEditDialog = (theme: Theme) => {
    setEditingTheme(theme);
    setFormData({
      theme_id: theme.theme_id,
      theme_name: theme.theme_name,
      dimension_id: theme.dimension_id,
    });
    setIsDialogOpen(true);
  };

  const filteredThemes = themes.filter(
    (t) =>
      t.theme_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.theme_id.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-2xl font-bold text-foreground">{t('themes')}</h1>
            <p className="text-muted-foreground">
              {language === 'th' ? 'จัดการข้อมูลหัวข้อ ESG' : 'Manage ESG theme data'}
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
                  {editingTheme
                    ? language === 'th'
                      ? 'แก้ไขหัวข้อ ESG'
                      : 'Edit ESG Theme'
                    : language === 'th'
                    ? 'เพิ่มหัวข้อ ESG'
                    : 'Add ESG Theme'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('themeId')} *</Label>
                  <Input
                    value={formData.theme_id}
                    onChange={(e) => setFormData({ ...formData, theme_id: e.target.value })}
                    disabled={!!editingTheme}
                    placeholder="e.g., E01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('themeName')} *</Label>
                  <Input
                    value={formData.theme_name}
                    onChange={(e) => setFormData({ ...formData, theme_name: e.target.value })}
                    placeholder={language === 'th' ? 'เช่น การจัดการพลังงาน' : 'e.g., Energy Management'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('dimension')} *</Label>
                  <Select
                    value={formData.dimension_id}
                    onValueChange={(value) => setFormData({ ...formData, dimension_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'th' ? 'เลือกมิติ' : 'Select dimension'} />
                    </SelectTrigger>
                    <SelectContent>
                      {dimensions.map((d) => (
                        <SelectItem key={d.dimension_id} value={d.dimension_id}>
                          {d.dimension_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <TableHead>{t('themeId')}</TableHead>
                  <TableHead>{t('themeName')}</TableHead>
                  <TableHead>{t('dimension')}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredThemes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredThemes.map((theme) => (
                    <TableRow key={theme.theme_id}>
                      <TableCell className="font-mono text-sm">{theme.theme_id}</TableCell>
                      <TableCell className="font-medium">{theme.theme_name}</TableCell>
                      <TableCell>
                        {dimensions.find((d) => d.dimension_id === theme.dimension_id)?.dimension_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(theme)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(theme.theme_id)}
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
