import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Database, Shield, Calendar } from 'lucide-react';
import { exportToExcel, generateExportFilename, ExportMetadata } from '@/lib/excelExport';

interface ReportingPeriod {
  period_id: string;
  year: number;
  month: number;
  month_name: string;
}

interface MetricValue {
  value_id: string;
  site_id: string;
  period_id: string;
  metric_id: string;
  value: number;
  status: string;
  data_source: string | null;
  remark: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function BackupData() {
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  
  // Filter state
  const [startPeriod, setStartPeriod] = useState<string>('');
  const [endPeriod, setEndPeriod] = useState<string>('');
  const [status, setStatus] = useState<string>('all');

  // Additional access control - only admin
  if (role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <Shield className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-semibold">
                  {language === 'th' ? 'ไม่มีสิทธิ์เข้าถึง' : 'Access Denied'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'th' 
                    ? 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงหน้านี้ได้' 
                    : 'Only administrators can access this page'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

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

  // NEW isolated read-only fetch function for backup export
  // This does NOT modify existing fetch functions
  const fetchTransactionsForBackup = async (): Promise<MetricValue[]> => {
    const PAGE_SIZE = 1000;
    let allValues: MetricValue[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('metric_value')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      // Apply period range filter if both are set
      if (startPeriod && endPeriod) {
        const startYear = parseInt(startPeriod.split('-')[0]);
        const startMonth = parseInt(startPeriod.split('-')[1]);
        const endYear = parseInt(endPeriod.split('-')[0]);
        const endMonth = parseInt(endPeriod.split('-')[1]);

        // Get periods within range
        const periodsInRange = periods.filter(p => {
          const periodValue = p.year * 100 + p.month;
          const startValue = startYear * 100 + startMonth;
          const endValue = endYear * 100 + endMonth;
          return periodValue >= startValue && periodValue <= endValue;
        });

        if (periodsInRange.length > 0) {
          query = query.in('period_id', periodsInRange.map(p => p.period_id));
        }
      } else if (startPeriod) {
        query = query.gte('period_id', startPeriod);
      } else if (endPeriod) {
        query = query.lte('period_id', endPeriod);
      }

      // Apply status filter
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allValues = [...allValues, ...data];
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    return allValues;
  };

  const handleExportTransactions = async () => {
    setExporting(true);

    try {
      const data = await fetchTransactionsForBackup();

      if (!data || data.length === 0) {
        toast({
          variant: 'destructive',
          title: language === 'th' ? 'ไม่มีข้อมูล' : 'No Data',
          description: language === 'th' ? 'ไม่มีข้อมูลให้ส่งออก' : 'No data to export',
        });
        setExporting(false);
        return;
      }

      const metadata: ExportMetadata = {
        exported_at: new Date().toISOString(),
        exported_by_id: user?.id || null,
        exported_by_email: user?.email || null,
        source_page: 'Backup Data - Transactions',
        applied_filters: {
          'Start Period': startPeriod || 'All',
          'End Period': endPeriod || 'All',
          'Status': status === 'all' ? 'All' : status,
        },
        total_rows: data.length,
      };

      const filename = generateExportFilename('transactions_backup');

      const columnLabels: Record<string, string> = {
        value_id: 'Value ID',
        site_id: 'Site ID',
        period_id: 'Period ID',
        metric_id: 'Metric ID',
        value: 'Value',
        status: 'Status',
        data_source: 'Data Source',
        remark: 'Remark',
        submitted_by: 'Submitted By (User ID)',
        approved_by: 'Approved By (User ID)',
        created_at: 'Created At',
        updated_at: 'Updated At',
      };

      const columnOrder = [
        'value_id',
        'site_id',
        'period_id',
        'metric_id',
        'value',
        'status',
        'data_source',
        'remark',
        'submitted_by',
        'approved_by',
        'created_at',
        'updated_at',
      ];

      exportToExcel({
        data: data as unknown as Record<string, unknown>[],
        filename,
        sheetName: 'Transactions',
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
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              {language === 'th' ? 'สำรองข้อมูล' : 'Backup Data'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'th'
                ? 'ส่งออกข้อมูลธุรกรรมทั้งหมดเป็นไฟล์ Excel สำหรับการสำรองข้อมูล'
                : 'Export all transaction data to Excel for backup purposes'}
            </p>
          </div>
        </div>

        {/* Transaction Export Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {language === 'th' ? 'ส่งออกข้อมูลธุรกรรม' : 'Export Transaction Data'}
            </CardTitle>
            <CardDescription>
              {language === 'th'
                ? 'เลือกช่วงเวลาและสถานะที่ต้องการส่งออก'
                : 'Select date range and status to export'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === 'th' ? 'เริ่มต้น (Period)' : 'Start Period'}</Label>
                <Select value={startPeriod} onValueChange={setStartPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกเดือนเริ่มต้น' : 'Select start period'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_start">
                      {language === 'th' ? 'ทั้งหมด (ไม่จำกัด)' : 'All (No limit)'}
                    </SelectItem>
                    {periods.map((p) => (
                      <SelectItem key={p.period_id} value={p.period_id}>
                        {p.month_name} {p.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'สิ้นสุด (Period)' : 'End Period'}</Label>
                <Select value={endPeriod} onValueChange={setEndPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'th' ? 'เลือกเดือนสิ้นสุด' : 'Select end period'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_end">
                      {language === 'th' ? 'ทั้งหมด (ไม่จำกัด)' : 'All (No limit)'}
                    </SelectItem>
                    {periods.map((p) => (
                      <SelectItem key={p.period_id} value={p.period_id}>
                        {p.month_name} {p.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'th' ? 'สถานะ' : 'Status'}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'th' ? 'ทั้งหมด' : 'All'}</SelectItem>
                    <SelectItem value="draft">{language === 'th' ? 'ฉบับร่าง' : 'Draft'}</SelectItem>
                    <SelectItem value="submitted">{language === 'th' ? 'ส่งแล้ว' : 'Submitted'}</SelectItem>
                    <SelectItem value="approved">{language === 'th' ? 'อนุมัติแล้ว' : 'Approved'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleExportTransactions}
                disabled={exporting || loading}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {language === 'th' ? 'Export Transactions Excel' : 'Export Transactions Excel'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-blue-900">
                  {language === 'th' ? 'ข้อมูลสำคัญเกี่ยวกับการสำรองข้อมูล' : 'Important Backup Information'}
                </p>
                <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                  <li>
                    {language === 'th'
                      ? 'การส่งออกจะส่งเฉพาะข้อมูลที่คุณมีสิทธิ์เข้าถึงตาม RLS policies'
                      : 'Export only includes data you have access to per RLS policies'}
                  </li>
                  <li>
                    {language === 'th'
                      ? 'ไฟล์ Excel จะมี Metadata sheet ที่ระบุรายละเอียดการส่งออก'
                      : 'Excel file includes a Metadata sheet with export details'}
                  </li>
                  <li>
                    {language === 'th'
                      ? 'การดำเนินการนี้เป็นแบบ Read-Only ไม่มีการเปลี่ยนแปลงข้อมูลในระบบ'
                      : 'This operation is Read-Only - no data modifications occur'}
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
