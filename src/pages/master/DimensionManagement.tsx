import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDeleteValidation } from '@/hooks/useDeleteValidation';
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
import { MasterDataLoadingSkeleton } from '@/components/ui/loading-skeleton';

interface Dimension {
  dimension_id: string;
  dimension_name: string;
}

export default function DimensionManagement() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { logActivity } = useAuditLog();
  const { checkDimensionDependencies } = useDeleteValidation();

  const [checkingDelete, setCheckingDelete] = useState(false);
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState<string | null>(null);

  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDimension, setEditingDimension] = useState<Dimension | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    dimension_name: '',
  });

  // Generate next dimension ID
  const generateNextId = (existingDimensions: Dimension[]) => {
    const prefix = 'DIM';
    const existingNumbers = existingDimensions
      .map(d => {
        const match = d.dimension_id.match(/^DIM(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return `${prefix}${String(maxNumber + 1).padStart(3, '0')}`;
  };

  useEffect(() => {
    fetchDimensions();
  }, []);

  const fetchDimensions = async () => {
    try {
      const { data, error } = await supabase
        .from('esg_dimension')
        .select('*')
        .order('dimension_name');

      if (error) throw error;
      setDimensions(data || []);
    } catch (error) {
      console.error('Error fetching dimensions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.dimension_name) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all required fields',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingDimension) {
        const { error } = await supabase
          .from('esg_dimension')
          .update({ dimension_name: formData.dimension_name })
          .eq('dimension_id', editingDimension.dimension_id);

        if (error) throw error;

        await logActivity({
          action: 'UPDATE',
          entityType: 'esg_dimension',
          entityId: editingDimension.dimension_id,
          beforeData: editingDimension,
          afterData: { dimension_id: editingDimension.dimension_id, dimension_name: formData.dimension_name },
        });
      } else {
        const newId = generateNextId(dimensions);
        const insertData = {
          dimension_id: newId,
          dimension_name: formData.dimension_name,
        };
        const { error } = await supabase.from('esg_dimension').insert(insertData);

        if (error) throw error;

        await logActivity({
          action: 'CREATE',
          entityType: 'esg_dimension',
          entityId: newId,
          afterData: insertData,
        });
      }

      toast({
        title: t('success'),
        description: language === 'th' ? 'บันทึกข้อมูลสำเร็จ' : 'Data saved successfully',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchDimensions();
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

  const handleDeleteClick = async (dimensionId: string) => {
    setCheckingDelete(true);
    setDeleteBlockedMessage(null);
    
    const { canDelete, message } = await checkDimensionDependencies(dimensionId);
    
    if (!canDelete) {
      setDeleteBlockedMessage(message);
    }
    
    setDeleteId(dimensionId);
    setCheckingDelete(false);
  };

  const handleDelete = async () => {
    if (!deleteId || deleteBlockedMessage) return;

    const dimensionToDelete = dimensions.find(d => d.dimension_id === deleteId);

    try {
      const { error } = await supabase.from('esg_dimension').delete().eq('dimension_id', deleteId);
      if (error) throw error;

      await logActivity({
        action: 'DELETE',
        entityType: 'esg_dimension',
        entityId: deleteId,
        beforeData: dimensionToDelete,
      });

      toast({
        title: t('success'),
        description: language === 'th' ? 'ลบข้อมูลสำเร็จ' : 'Data deleted successfully',
      });

      fetchDimensions();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message,
      });
    } finally {
      setDeleteId(null);
      setDeleteBlockedMessage(null);
    }
  };

  const resetForm = () => {
    setFormData({ dimension_name: '' });
    setEditingDimension(null);
  };

  const openEditDialog = (dimension: Dimension) => {
    setEditingDimension(dimension);
    setFormData({
      dimension_name: dimension.dimension_name,
    });
    setIsDialogOpen(true);
  };

  const filteredDimensions = dimensions.filter(
    (d) =>
      d.dimension_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.dimension_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <MasterDataLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('dimensions')}</h1>
            <p className="text-muted-foreground">
              {language === 'th' ? 'จัดการข้อมูลมิติ ESG' : 'Manage ESG dimension data'}
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
                  {editingDimension
                    ? language === 'th'
                      ? 'แก้ไขมิติ ESG'
                      : 'Edit ESG Dimension'
                    : language === 'th'
                    ? 'เพิ่มมิติ ESG'
                    : 'Add ESG Dimension'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('dimensionName')} *</Label>
                  <Input
                    value={formData.dimension_name}
                    onChange={(e) => setFormData({ ...formData, dimension_name: e.target.value })}
                    placeholder={language === 'th' ? 'เช่น สิ่งแวดล้อม' : 'e.g., Environmental'}
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
                  <TableHead>{t('dimensionName')}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDimensions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDimensions.map((dimension) => (
                    <TableRow key={dimension.dimension_id}>
                      <TableCell className="font-medium">{dimension.dimension_name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(dimension)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(dimension.dimension_id)}
                            disabled={checkingDelete}
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

        <AlertDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteBlockedMessage(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteBlockedMessage 
                  ? (language === 'th' ? 'ไม่สามารถลบได้' : 'Cannot Delete')
                  : t('confirmDelete')}
              </AlertDialogTitle>
              <AlertDialogDescription className="whitespace-pre-line">
                {deleteBlockedMessage || (language === 'th'
                  ? 'การลบข้อมูลนี้ไม่สามารถย้อนกลับได้'
                  : 'This action cannot be undone.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{deleteBlockedMessage ? (language === 'th' ? 'ปิด' : 'Close') : t('cancel')}</AlertDialogCancel>
              {!deleteBlockedMessage && (
                <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
