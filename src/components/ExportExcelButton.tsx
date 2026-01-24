import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { exportToExcel, generateExportFilename, ExportMetadata } from '@/lib/excelExport';
import { Download, Loader2 } from 'lucide-react';

interface ExportExcelButtonProps {
  data: Record<string, unknown>[];
  filenamePrefix: string;
  sourcePage: string;
  appliedFilters?: Record<string, string>;
  columnOrder?: string[];
  columnLabels?: Record<string, string>;
  sheetName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ExportExcelButton({
  data,
  filenamePrefix,
  sourcePage,
  appliedFilters = {},
  columnOrder,
  columnLabels,
  sheetName,
  variant = 'outline',
  size = 'sm',
  className,
}: ExportExcelButtonProps) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();

  const handleExport = async () => {
    if (!data || data.length === 0) {
      toast({
        variant: 'destructive',
        title: language === 'th' ? 'ไม่มีข้อมูล' : 'No Data',
        description: language === 'th' ? 'ไม่มีข้อมูลให้ส่งออก' : 'No data to export',
      });
      return;
    }

    setExporting(true);

    try {
      const metadata: ExportMetadata = {
        exported_at: new Date().toISOString(),
        exported_by_id: user?.id || null,
        exported_by_email: user?.email || null,
        source_page: sourcePage,
        applied_filters: appliedFilters,
        total_rows: data.length,
      };

      const filename = generateExportFilename(filenamePrefix);

      exportToExcel({
        data,
        filename,
        sheetName: sheetName || 'Data',
        metadata,
        columnOrder,
        columnLabels,
      });

      toast({
        title: language === 'th' ? 'ส่งออกสำเร็จ' : 'Export Successful',
        description: language === 'th' 
          ? `ส่งออก ${data.length} รายการไปยัง ${filename}` 
          : `Exported ${data.length} rows to ${filename}`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: language === 'th' ? 'เกิดข้อผิดพลาด' : 'Export Failed',
        description: error.message || (language === 'th' ? 'ไม่สามารถส่งออกได้' : 'Unable to export data'),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={exporting || !data || data.length === 0}
      className={className}
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {language === 'th' ? 'Export Excel' : 'Export Excel'}
    </Button>
  );
}
