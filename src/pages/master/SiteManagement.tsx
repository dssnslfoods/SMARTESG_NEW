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

interface Site {
  site_id: string;
  site_name: string;
  company_id: string;
  location: string | null;
}

interface Company {
  company_id: string;
  company_name: string;
}

export default function SiteManagement() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { logActivity } = useAuditLog();

  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    site_id: '',
    site_name: '',
    company_id: '',
    location: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sitesRes, companiesRes] = await Promise.all([
        supabase.from('site').select('*').order('site_name'),
        supabase.from('company').select('company_id, company_name'),
      ]);

      setSites(sitesRes.data || []);
      setCompanies(companiesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.site_id || !formData.site_name || !formData.company_id) {
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
        site_name: formData.site_name,
        company_id: formData.company_id,
        location: formData.location || null,
      };

      if (editingSite) {
        const { error } = await supabase
          .from('site')
          .update(dataToSave)
          .eq('site_id', editingSite.site_id);

        if (error) throw error;

        await logActivity({
          action: 'UPDATE',
          entityType: 'site',
          entityId: editingSite.site_id,
          beforeData: editingSite,
          afterData: { ...dataToSave, site_id: editingSite.site_id },
        });
      } else {
        const insertData = { ...dataToSave, site_id: formData.site_id };
        const { error } = await supabase.from('site').insert(insertData);

        if (error) throw error;

        await logActivity({
          action: 'CREATE',
          entityType: 'site',
          entityId: formData.site_id,
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

    const siteToDelete = sites.find(s => s.site_id === deleteId);

    try {
      const { error } = await supabase.from('site').delete().eq('site_id', deleteId);
      if (error) throw error;

      await logActivity({
        action: 'DELETE',
        entityType: 'site',
        entityId: deleteId,
        beforeData: siteToDelete,
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
    setFormData({ site_id: '', site_name: '', company_id: '', location: '' });
    setEditingSite(null);
  };

  const openEditDialog = (site: Site) => {
    setEditingSite(site);
    setFormData({
      site_id: site.site_id,
      site_name: site.site_name,
      company_id: site.company_id,
      location: site.location || '',
    });
    setIsDialogOpen(true);
  };

  const filteredSites = sites.filter(
    (s) =>
      s.site_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.site_id.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-2xl font-bold text-foreground">{t('sites')}</h1>
            <p className="text-muted-foreground">
              {language === 'th' ? 'จัดการข้อมูลสถานที่' : 'Manage site data'}
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
                  {editingSite
                    ? language === 'th'
                      ? 'แก้ไขสถานที่'
                      : 'Edit Site'
                    : language === 'th'
                    ? 'เพิ่มสถานที่'
                    : 'Add Site'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('siteId')} *</Label>
                  <Input
                    value={formData.site_id}
                    onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                    disabled={!!editingSite}
                    placeholder="e.g., SITE001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('siteName')} *</Label>
                  <Input
                    value={formData.site_name}
                    onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('company')} *</Label>
                  <Select
                    value={formData.company_id}
                    onValueChange={(value) => setFormData({ ...formData, company_id: value })}
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
                  <Label>{t('location')}</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
                  <TableHead>{t('siteId')}</TableHead>
                  <TableHead>{t('siteName')}</TableHead>
                  <TableHead>{t('company')}</TableHead>
                  <TableHead>{t('location')}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSites.map((site) => (
                    <TableRow key={site.site_id}>
                      <TableCell className="font-mono text-sm">{site.site_id}</TableCell>
                      <TableCell className="font-medium">{site.site_name}</TableCell>
                      <TableCell>
                        {companies.find((c) => c.company_id === site.company_id)?.company_name || '-'}
                      </TableCell>
                      <TableCell>{site.location || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(site)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(site.site_id)}
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
