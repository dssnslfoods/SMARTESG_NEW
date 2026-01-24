import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2, AlertTriangle, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';

// Expected column headers from exported file
const EXPECTED_COLUMNS = [
  'Company', 'Site', 'Period', 'Dimension', 'Theme', 
  'Metric', 'Value', 'Unit', 'Status', 'Data Source', 'Remark'
];

interface ImportRow {
  rowIndex: number;
  company: string;
  site: string;
  period: string;
  dimension: string;
  theme: string;
  metric: string;
  value: number;
  unit: string;
  status: string;
  data_source: string;
  remark: string;
  // Validation results
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
  // Resolved IDs
  site_id?: string;
  period_id?: string;
  metric_id?: string;
  // Selection for duplicates
  selected: boolean;
}

interface LookupData {
  companies: { company_id: string; company_name: string }[];
  sites: { site_id: string; site_name: string; company_id: string }[];
  periods: { period_id: string; year: number; month: number; month_name: string }[];
  dimensions: { dimension_id: string; dimension_name: string }[];
  themes: { theme_id: string; theme_name: string; dimension_id: string }[];
  metrics: { metric_id: string; metric_name: string; theme_id: string; unit: string | null }[];
}

interface ExistingRecord {
  value_id: string;
  site_id: string;
  period_id: string;
  metric_id: string;
}

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookupData: LookupData;
  onImportComplete: () => void;
}

export function ImportExcelDialog({
  open,
  onOpenChange,
  lookupData,
  onImportComplete,
}: ImportExcelDialogProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Build lookup maps
  const companyMap = new Map(lookupData.companies.map(c => [c.company_name.toLowerCase(), c.company_id]));
  const siteMap = new Map(lookupData.sites.map(s => [`${s.site_name.toLowerCase()}|${s.company_id}`, s.site_id]));
  const periodMap = new Map(lookupData.periods.map(p => [`${p.month_name.toLowerCase()} ${p.year}`, p.period_id]));
  const dimensionMap = new Map(lookupData.dimensions.map(d => [d.dimension_name.toLowerCase(), d.dimension_id]));
  const themeMap = new Map(lookupData.themes.map(t => [`${t.theme_name.toLowerCase()}|${t.dimension_id}`, t.theme_id]));
  const metricMap = new Map(lookupData.metrics.map(m => [`${m.metric_name.toLowerCase()}|${m.theme_id}`, m.metric_id]));

  const resetDialog = () => {
    setStep('upload');
    setFileName('');
    setImportRows([]);
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Find KPI Data sheet
      const sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase() === 'kpi data' || name.toLowerCase() === 'data'
      ) || workbook.SheetNames[0];
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

      if (jsonData.length < 2) {
        toast({
          variant: 'destructive',
          title: language === 'th' ? 'ไฟล์ว่างเปล่า' : 'Empty File',
          description: language === 'th' ? 'ไม่พบข้อมูลในไฟล์' : 'No data found in file',
        });
        return;
      }

      // Validate headers
      const headers = (jsonData[0] as string[]).map(h => String(h).trim());
      const missingColumns = EXPECTED_COLUMNS.filter(col => 
        !headers.some(h => h.toLowerCase() === col.toLowerCase())
      );

      if (missingColumns.length > 0) {
        toast({
          variant: 'destructive',
          title: language === 'th' ? 'คอลัมน์ไม่ครบ' : 'Missing Columns',
          description: `${language === 'th' ? 'ขาดคอลัมน์' : 'Missing'}: ${missingColumns.join(', ')}`,
        });
        return;
      }

      // Map column indices
      const colIndex: Record<string, number> = {};
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase();
        if (normalized === 'company') colIndex.company = i;
        else if (normalized === 'site') colIndex.site = i;
        else if (normalized === 'period') colIndex.period = i;
        else if (normalized === 'dimension') colIndex.dimension = i;
        else if (normalized === 'theme') colIndex.theme = i;
        else if (normalized === 'metric') colIndex.metric = i;
        else if (normalized === 'value') colIndex.value = i;
        else if (normalized === 'unit') colIndex.unit = i;
        else if (normalized === 'status') colIndex.status = i;
        else if (normalized === 'data source') colIndex.data_source = i;
        else if (normalized === 'remark') colIndex.remark = i;
      });

      // Fetch existing records for duplicate check
      const { data: existingRecords } = await supabase
        .from('metric_value')
        .select('value_id, site_id, period_id, metric_id');

      const existingMap = new Map<string, ExistingRecord>();
      (existingRecords || []).forEach(r => {
        existingMap.set(`${r.site_id}|${r.period_id}|${r.metric_id}`, r);
      });

      // Parse rows with validation
      const rows: ImportRow[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[];
        if (!row || row.length === 0) continue;

        const companyName = String(row[colIndex.company] ?? '').trim();
        const siteName = String(row[colIndex.site] ?? '').trim();
        const periodStr = String(row[colIndex.period] ?? '').trim();
        const dimensionName = String(row[colIndex.dimension] ?? '').trim();
        const themeName = String(row[colIndex.theme] ?? '').trim();
        const metricName = String(row[colIndex.metric] ?? '').trim();
        const valueRaw = row[colIndex.value];
        const unit = String(row[colIndex.unit] ?? '').trim();
        const status = String(row[colIndex.status] ?? 'draft').trim().toLowerCase();
        const dataSource = String(row[colIndex.data_source] ?? '').trim();
        const remark = String(row[colIndex.remark] ?? '').trim();

        const errors: string[] = [];
        
        // Resolve company
        const company_id = companyMap.get(companyName.toLowerCase());
        if (!company_id) {
          errors.push(`Company "${companyName}" not found`);
        }

        // Resolve site (requires company)
        let site_id: string | undefined;
        if (company_id) {
          site_id = siteMap.get(`${siteName.toLowerCase()}|${company_id}`);
          if (!site_id) {
            errors.push(`Site "${siteName}" not found in company "${companyName}"`);
          }
        }

        // Resolve period
        const period_id = periodMap.get(periodStr.toLowerCase());
        if (!period_id) {
          errors.push(`Period "${periodStr}" not found`);
        }

        // Resolve dimension
        const dimension_id = dimensionMap.get(dimensionName.toLowerCase());
        if (!dimension_id) {
          errors.push(`Dimension "${dimensionName}" not found`);
        }

        // Resolve theme (requires dimension)
        let theme_id: string | undefined;
        if (dimension_id) {
          theme_id = themeMap.get(`${themeName.toLowerCase()}|${dimension_id}`);
          if (!theme_id) {
            errors.push(`Theme "${themeName}" not found in dimension "${dimensionName}"`);
          }
        }

        // Resolve metric (requires theme)
        let metric_id: string | undefined;
        if (theme_id) {
          metric_id = metricMap.get(`${metricName.toLowerCase()}|${theme_id}`);
          if (!metric_id) {
            errors.push(`Metric "${metricName}" not found in theme "${themeName}"`);
          }
        }

        // Validate value
        const value = parseFloat(String(valueRaw));
        if (isNaN(value)) {
          errors.push(`Invalid value: "${valueRaw}"`);
        }

        // Check for duplicate (same site + period + metric)
        const isDuplicate = !!(site_id && period_id && metric_id && 
          existingMap.has(`${site_id}|${period_id}|${metric_id}`));

        rows.push({
          rowIndex: i + 1,
          company: companyName,
          site: siteName,
          period: periodStr,
          dimension: dimensionName,
          theme: themeName,
          metric: metricName,
          value: isNaN(value) ? 0 : value,
          unit,
          status: status === 'submitted' ? 'submitted' : 'draft',
          data_source: dataSource,
          remark,
          isValid: errors.length === 0,
          isDuplicate,
          errors,
          site_id,
          period_id,
          metric_id,
          selected: !isDuplicate, // Auto-select non-duplicates
        });
      }

      setImportRows(rows);
      setStep('preview');

    } catch (error: any) {
      console.error('Error parsing file:', error);
      toast({
        variant: 'destructive',
        title: language === 'th' ? 'อ่านไฟล์ไม่ได้' : 'File Read Error',
        description: error.message,
      });
    }
  };

  const toggleRowSelection = (index: number) => {
    setImportRows(prev => prev.map((row, i) => 
      i === index ? { ...row, selected: !row.selected } : row
    ));
  };

  const selectAllDuplicates = (select: boolean) => {
    setImportRows(prev => prev.map(row => 
      row.isDuplicate && row.isValid ? { ...row, selected: select } : row
    ));
  };

  const handleImport = async () => {
    const selectedRows = importRows.filter(r => r.selected && r.isValid);
    if (selectedRows.length === 0) {
      toast({
        variant: 'destructive',
        title: language === 'th' ? 'ไม่มีข้อมูลที่เลือก' : 'No Rows Selected',
        description: language === 'th' ? 'กรุณาเลือกรายการที่ต้องการ import' : 'Please select rows to import',
      });
      return;
    }

    setImporting(true);
    setStep('importing');
    setImportProgress({ current: 0, total: selectedRows.length });

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      setImportProgress({ current: i + 1, total: selectedRows.length });

      try {
        if (row.isDuplicate) {
          // Update existing record
          const { error } = await supabase
            .from('metric_value')
            .update({
              value: row.value,
              status: row.status,
              data_source: row.data_source || null,
              remark: row.remark || null,
              submitted_by: user?.id,
            })
            .eq('site_id', row.site_id!)
            .eq('period_id', row.period_id!)
            .eq('metric_id', row.metric_id!);

          if (error) throw error;
          updatedCount++;
        } else {
          // Insert new record
          const value_id = `VAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const { error } = await supabase
            .from('metric_value')
            .insert({
              value_id,
              site_id: row.site_id!,
              period_id: row.period_id!,
              metric_id: row.metric_id!,
              value: row.value,
              status: row.status,
              data_source: row.data_source || null,
              remark: row.remark || null,
              submitted_by: user?.id,
            });

          if (error) throw error;
          insertedCount++;
        }
      } catch (error: any) {
        console.error(`Error importing row ${row.rowIndex}:`, error);
        errorCount++;
      }
    }

    setImporting(false);

    toast({
      title: language === 'th' ? 'Import สำเร็จ' : 'Import Complete',
      description: language === 'th'
        ? `เพิ่มใหม่ ${insertedCount} รายการ, อัปเดต ${updatedCount} รายการ${errorCount > 0 ? `, ล้มเหลว ${errorCount} รายการ` : ''}`
        : `Inserted ${insertedCount}, Updated ${updatedCount}${errorCount > 0 ? `, Failed ${errorCount}` : ''}`,
    });

    onImportComplete();
    onOpenChange(false);
    resetDialog();
  };

  const validRows = importRows.filter(r => r.isValid);
  const invalidRows = importRows.filter(r => !r.isValid);
  const duplicateRows = importRows.filter(r => r.isDuplicate && r.isValid);
  const newRows = importRows.filter(r => !r.isDuplicate && r.isValid);
  const selectedCount = importRows.filter(r => r.selected && r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetDialog(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {language === 'th' ? 'Import ข้อมูล KPI จาก Excel' : 'Import KPI Data from Excel'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && (language === 'th' 
              ? 'เลือกไฟล์ Excel ที่ export จากระบบ (ต้องมีคอลัมน์ครบตามที่กำหนด)'
              : 'Select an Excel file exported from this system (must have all required columns)')}
            {step === 'preview' && (language === 'th'
              ? 'ตรวจสอบข้อมูลก่อน import - เลือกรายการที่ต้องการ'
              : 'Review data before import - select rows to import')}
            {step === 'importing' && (language === 'th'
              ? `กำลัง import... ${importProgress.current}/${importProgress.total}`
              : `Importing... ${importProgress.current}/${importProgress.total}`)}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {language === 'th' ? 'ลากไฟล์มาวางหรือคลิกเพื่อเลือกไฟล์' : 'Drag & drop or click to select file'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              {language === 'th' ? 'เลือกไฟล์ Excel' : 'Select Excel File'}
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                {fileName}
              </Badge>
              <Badge variant="secondary">
                {language === 'th' ? 'ทั้งหมด' : 'Total'}: {importRows.length}
              </Badge>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                {language === 'th' ? 'ใหม่' : 'New'}: {newRows.length}
              </Badge>
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {language === 'th' ? 'ซ้ำ (จะ update)' : 'Duplicate'}: {duplicateRows.length}
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {language === 'th' ? 'ผิดพลาด' : 'Invalid'}: {invalidRows.length}
                </Badge>
              )}
            </div>

            {/* Duplicate selection controls */}
            {duplicateRows.length > 0 && (
              <div className="flex items-center gap-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  {language === 'th' 
                    ? `พบ ${duplicateRows.length} รายการที่มีอยู่แล้ว (Site + Period + Metric ซ้ำ)`
                    : `Found ${duplicateRows.length} existing records (duplicate Site + Period + Metric)`}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => selectAllDuplicates(true)}>
                    {language === 'th' ? 'เลือก Update ทั้งหมด' : 'Select All Duplicates'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => selectAllDuplicates(false)}>
                    {language === 'th' ? 'ยกเลิก Update ทั้งหมด' : 'Deselect All Duplicates'}
                  </Button>
                </div>
              </div>
            )}

            {/* Data table */}
            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{language === 'th' ? 'สถานะ' : 'Status'}</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>{language === 'th' ? 'ปัญหา' : 'Issues'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.map((row, index) => (
                    <TableRow 
                      key={index}
                      className={!row.isValid ? 'bg-destructive/5' : row.isDuplicate ? 'bg-yellow-50 dark:bg-yellow-950/30' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={row.selected}
                          disabled={!row.isValid}
                          onCheckedChange={() => toggleRowSelection(index)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.rowIndex}</TableCell>
                      <TableCell>
                        {!row.isValid ? (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            {language === 'th' ? 'ผิดพลาด' : 'Invalid'}
                          </Badge>
                        ) : row.isDuplicate ? (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {language === 'th' ? 'ซ้ำ' : 'Duplicate'}
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {language === 'th' ? 'ใหม่' : 'New'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-24 truncate">{row.company}</TableCell>
                      <TableCell className="max-w-24 truncate">{row.site}</TableCell>
                      <TableCell>{row.period}</TableCell>
                      <TableCell className="max-w-32 truncate">{row.metric}</TableCell>
                      <TableCell className="text-right font-mono">{row.value}</TableCell>
                      <TableCell className="max-w-48">
                        {row.errors.length > 0 && (
                          <span className="text-xs text-destructive">{row.errors.join('; ')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">
              {language === 'th' ? 'กำลัง Import ข้อมูล...' : 'Importing Data...'}
            </p>
            <p className="text-muted-foreground">
              {importProgress.current} / {importProgress.total}
            </p>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetDialog}>
                {language === 'th' ? 'เลือกไฟล์ใหม่' : 'Select Different File'}
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={selectedCount === 0}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {language === 'th' 
                  ? `Import ${selectedCount} รายการ`
                  : `Import ${selectedCount} Rows`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
