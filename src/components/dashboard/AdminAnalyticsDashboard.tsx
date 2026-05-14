import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Clock,
  Calendar as CalendarIcon,
  Activity,
  BarChart3,
  Filter,
  X,
  CalendarDays,
  Send,
  FileEdit,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { fetchMetricValuesWithTimestamp, FETCH_CONFIG } from '@/lib/dataFetcher';

interface MetricValueRecord {
  value_id: string;
  submitted_by: string | null;
  created_at: string | null;
  status: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
}

interface UserSubmissionStats {
  userId: string;
  userName: string;
  totalSubmissions: number;
  avgPerDay: number;
  firstSubmission: string | null;
  lastSubmission: string | null;
}

interface HourlyData {
  hour: string;
  count: number;
  label: string;
}

interface DailyData {
  date: string;
  count: number;
  label: string;
}

export default function AdminAnalyticsDashboard() {
  const { language } = useLanguage();
  
  // Raw data
  const [allMetricValues, setAllMetricValues] = useState<MetricValueRecord[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedHourRange, setSelectedHourRange] = useState<string>('all');

  useEffect(() => {
    fetchRawData();
  }, []);

  const fetchRawData = async () => {
    try {
      // Use optimized fetcher with larger batch size for 100K+ records
      const metricValues = await fetchMetricValuesWithTimestamp({
        pageSize: FETCH_CONFIG.PAGE_SIZE,
      });

      if (metricValues && metricValues.length > 0) {
        setAllMetricValues(metricValues.map(v => ({
          value_id: v.value_id,
          submitted_by: v.submitted_by,
          created_at: v.created_at,
          status: v.status,
        })));

        // Fetch user profiles for the unique submitters
        const uniqueUserIds = [...new Set(metricValues.filter(m => m.submitted_by).map(m => m.submitted_by))] as string[];
        
        if (uniqueUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('app_user_profile')
            .select('user_id, full_name')
            .in('user_id', uniqueUserIds);

          setUserProfiles(profiles || []);
        }
        
        if (FETCH_CONFIG.DEBUG_MODE) {
          console.log(`[AdminAnalytics] Loaded ${metricValues.length} records`);
        }
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on selections
  const filteredData = useMemo(() => {
    let filtered = [...allMetricValues];

    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(mv => mv.submitted_by === selectedUser);
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      filtered = filtered.filter(mv => {
        if (!mv.created_at) return false;
        const entryDate = new Date(mv.created_at);
        
        if (dateFrom && dateTo) {
          return isWithinInterval(entryDate, { 
            start: startOfDay(dateFrom), 
            end: endOfDay(dateTo) 
          });
        } else if (dateFrom) {
          return entryDate >= startOfDay(dateFrom);
        } else if (dateTo) {
          return entryDate <= endOfDay(dateTo);
        }
        return true;
      });
    }

    // Filter by hour range
    if (selectedHourRange !== 'all') {
      const [startHour, endHour] = selectedHourRange.split('-').map(Number);
      filtered = filtered.filter(mv => {
        if (!mv.created_at) return false;
        const hour = new Date(mv.created_at).getHours();
        return hour >= startHour && hour <= endHour;
      });
    }

    return filtered;
  }, [allMetricValues, selectedUser, dateFrom, dateTo, selectedHourRange]);

  // Calculate analytics from filtered data (matches Data Entry page calculation)
  const analytics = useMemo(() => {
    const totalEntries = filteredData.length;
    // Match Data Entry: status === 'submitted' only
    const totalSubmitted = filteredData.filter(mv => mv.status === 'submitted').length;
    // Match Data Entry: status === 'draft' only
    const totalDrafted = filteredData.filter(mv => mv.status === 'draft').length;

    // User stats
    const userSubmissionMap = new Map<string, { count: number; dates: Date[] }>();
    
    filteredData.forEach(mv => {
      if (mv.submitted_by) {
        const existing = userSubmissionMap.get(mv.submitted_by) || { count: 0, dates: [] };
        existing.count++;
        if (mv.created_at) {
          existing.dates.push(new Date(mv.created_at));
        }
        userSubmissionMap.set(mv.submitted_by, existing);
      }
    });

    const userStatsArray: UserSubmissionStats[] = [];
    userSubmissionMap.forEach((value, key) => {
      const profile = userProfiles.find(p => p.user_id === key);
      const sortedDates = value.dates.sort((a, b) => a.getTime() - b.getTime());
      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];
      
      const daySpan = firstDate && lastDate 
        ? Math.max(1, differenceInDays(lastDate, firstDate) + 1)
        : 1;
      
      userStatsArray.push({
        userId: key,
        userName: profile?.full_name || 'Unknown User',
        totalSubmissions: value.count,
        avgPerDay: Math.round((value.count / daySpan) * 100) / 100,
        firstSubmission: firstDate ? firstDate.toISOString() : null,
        lastSubmission: lastDate ? lastDate.toISOString() : null,
      });
    });
    userStatsArray.sort((a, b) => b.totalSubmissions - a.totalSubmissions);

    // Hourly distribution
    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, 0);
    }

    filteredData.forEach(mv => {
      if (mv.created_at) {
        const hour = new Date(mv.created_at).getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      }
    });

    const hourlyDataArray: HourlyData[] = [];
    let maxHour = { hour: 0, count: 0 };
    
    hourlyMap.forEach((count, hour) => {
      const label = `${hour.toString().padStart(2, '0')}:00`;
      hourlyDataArray.push({ hour: hour.toString(), count, label });
      if (count > maxHour.count) {
        maxHour = { hour, count };
      }
    });

    // Daily distribution
    const dailyMap = new Map<string, number>();
    
    filteredData.forEach(mv => {
      if (mv.created_at) {
        const dateStr = format(parseISO(mv.created_at), 'yyyy-MM-dd');
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
      }
    });

    const dailyDataArray: DailyData[] = [];
    let maxDay = { date: '', count: 0 };

    dailyMap.forEach((count, date) => {
      dailyDataArray.push({
        date,
        count,
        label: format(parseISO(date), 'MMM dd'),
      });
      if (count > maxDay.count) {
        maxDay = { date, count };
      }
    });

    dailyDataArray.sort((a, b) => a.date.localeCompare(b.date));
    const last30Days = dailyDataArray.slice(-30);

    // Calculate overall average
    const overallAvg = totalEntries > 0 && last30Days.length > 0
      ? Math.round((totalEntries / Math.max(1, last30Days.length)) * 100) / 100
      : 0;

    return {
      totalEntries,
      totalSubmitted,
      totalDrafted,
      userStats: userStatsArray,
      hourlyData: hourlyDataArray,
      dailyData: last30Days,
      peakHour: maxHour.count > 0 ? { hour: `${maxHour.hour.toString().padStart(2, '0')}:00`, count: maxHour.count } : null,
      peakDay: maxDay.date ? { date: format(parseISO(maxDay.date), 'MMM dd, yyyy'), count: maxDay.count } : null,
      overallAvg,
    };
  }, [filteredData, userProfiles]);

  // Available users for filter
  const availableUsers = useMemo(() => {
    const uniqueUserIds = [...new Set(allMetricValues.filter(m => m.submitted_by).map(m => m.submitted_by))] as string[];
    return uniqueUserIds.map(userId => {
      const profile = userProfiles.find(p => p.user_id === userId);
      return { userId, userName: profile?.full_name || 'Unknown User' };
    }).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [allMetricValues, userProfiles]);

  const hourRanges = [
    { value: 'all', label: language === 'th' ? 'ทุกช่วงเวลา' : 'All Hours' },
    { value: '0-5', label: language === 'th' ? '00:00-05:59 (กลางคืน)' : '00:00-05:59 (Night)' },
    { value: '6-11', label: language === 'th' ? '06:00-11:59 (เช้า)' : '06:00-11:59 (Morning)' },
    { value: '12-17', label: language === 'th' ? '12:00-17:59 (บ่าย)' : '12:00-17:59 (Afternoon)' },
    { value: '18-23', label: language === 'th' ? '18:00-23:59 (เย็น)' : '18:00-23:59 (Evening)' },
  ];

  const clearFilters = () => {
    setSelectedUser('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedHourRange('all');
  };

  const hasActiveFilters = selectedUser !== 'all' || dateFrom || dateTo || selectedHourRange !== 'all';

  if (loading) {
    return (
      <Card className="bg-white/70 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-xl shadow-gray-900/5">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="animate-pulse text-gray-500">
            {language === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading analytics...'}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allMetricValues.length === 0) {
    return (
      <Card className="bg-white/70 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-xl shadow-gray-900/5">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-3 text-base sm:text-lg text-gray-900">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            {language === 'th' ? 'การวิเคราะห์ข้อมูลผู้ใช้' : 'User Analytics Dashboard'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-gray-500">
          {language === 'th' ? 'ยังไม่มีข้อมูลสำหรับวิเคราะห์' : 'No data available for analysis'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {language === 'th' ? 'การวิเคราะห์ข้อมูลผู้ใช้' : 'User Analytics Dashboard'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            {language === 'th' ? 'สถิติและแนวโน้มการลงข้อมูล' : 'Entry statistics and trends'}
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-violet-600" />
              {language === 'th' ? 'ตัวกรอง' : 'Filters'}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs text-gray-500 hover:text-gray-700"
              >
                <X className="h-3 w-3 mr-1" />
                {language === 'th' ? 'ล้างตัวกรอง' : 'Clear'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* User Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                {language === 'th' ? 'ผู้ใช้' : 'User'}
              </label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/30">
                  <SelectValue placeholder={language === 'th' ? 'เลือกผู้ใช้' : 'Select user'} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl">
                  <SelectItem value="all">{language === 'th' ? 'ทุกคน' : 'All Users'}</SelectItem>
                  {availableUsers.map(user => (
                    <SelectItem key={user.userId} value={user.userId}>
                      {user.userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                {language === 'th' ? 'ตั้งแต่วันที่' : 'From Date'}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white/80 backdrop-blur border-gray-200 rounded-xl",
                      !dateFrom && "text-gray-400"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : (language === 'th' ? 'เลือกวันที่' : 'Pick a date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                {language === 'th' ? 'ถึงวันที่' : 'To Date'}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white/80 backdrop-blur border-gray-200 rounded-xl",
                      !dateTo && "text-gray-400"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : (language === 'th' ? 'เลือกวันที่' : 'Pick a date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Hour Range Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                {language === 'th' ? 'ช่วงเวลา' : 'Time Range'}
              </label>
              <Select value={selectedHourRange} onValueChange={setSelectedHourRange}>
                <SelectTrigger className="bg-white/80 backdrop-blur border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50 rounded-xl">
                  {hourRanges.map(range => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Peak Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {/* Total Entries */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'ทั้งหมด' : 'Total Entries'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{(analytics.totalEntries ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        {/* Total Submitted */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'ส่งแล้ว' : 'Submitted'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-green-100 flex items-center justify-center">
                <Send className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{(analytics.totalSubmitted ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        {/* Total Drafted */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'ฉบับร่าง' : 'Drafted'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <FileEdit className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{(analytics.totalDrafted ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'ผู้ใช้' : 'Users'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{(analytics.userStats.length ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        {/* Average per Day */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'เฉลี่ย/วัน' : 'Avg/Day'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{typeof analytics.overallAvg === 'number' ? analytics.overallAvg.toLocaleString(undefined, { maximumFractionDigits: 2 }) : analytics.overallAvg}</div>
          </CardContent>
        </Card>

        {/* Peak Hour */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'ชั่วโมงยอดนิยม' : 'Peak Hour'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-orange-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{analytics.peakHour?.hour || '-'}</div>
            <div className="text-xs text-gray-400 mt-1">
              {analytics.peakHour ? `${analytics.peakHour.count} ${language === 'th' ? 'รายการ' : 'entries'}` : ''}
            </div>
          </CardContent>
        </Card>

        {/* Peak Day */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'วันยอดนิยม' : 'Peak Day'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 truncate">{analytics.peakDay?.date || '-'}</div>
            <div className="text-xs text-gray-400 mt-1">
              {analytics.peakDay ? `${analytics.peakDay.count} ${language === 'th' ? 'รายการ' : 'entries'}` : ''}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Peak Hour Bar Chart */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-xl shadow-gray-900/5">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-900">
              <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              {language === 'th' ? 'กิจกรรมตามชั่วโมง' : 'Hourly Activity'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-gray-500">
              {language === 'th' ? 'จำนวนรายการที่ลงในแต่ละชั่วโมง' : 'Number of entries per hour'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    interval={2}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(229, 231, 235, 0.5)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value) => [value, language === 'th' ? 'รายการ' : 'Entries']}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="url(#barGradientAnalytics)" 
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="barGradientAnalytics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Trend Line Chart */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-xl shadow-gray-900/5">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-900">
              <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              {language === 'th' ? 'แนวโน้มรายวัน' : 'Daily Trend'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-gray-500">
              {language === 'th' ? 'จำนวนรายการตามช่วงเวลาที่เลือก' : 'Entries based on selected filters'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(229, 231, 235, 0.5)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value) => [value, language === 'th' ? 'รายการ' : 'Entries']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 6, fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Submission Stats Table */}
      <Card className="bg-white/70 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-xl shadow-gray-900/5">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-900">
            <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            {language === 'th' ? 'สถิติการลงข้อมูลรายบุคคล' : 'User Submission Statistics'}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-gray-500">
            {language === 'th' ? 'จำนวนและค่าเฉลี่ยการลงข้อมูลของแต่ละผู้ใช้' : 'Total and average entries per user'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {analytics.userStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {language === 'th' ? 'ไม่พบข้อมูลตามเงื่อนไขที่เลือก' : 'No data matching selected filters'}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200/50">
                    <TableHead className="text-xs sm:text-sm text-gray-600">
                      {language === 'th' ? 'ผู้ใช้' : 'User'}
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-gray-600 text-right">
                      {language === 'th' ? 'จำนวนรายการ' : 'Total Entries'}
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-gray-600 text-right hidden sm:table-cell">
                      {language === 'th' ? 'เฉลี่ย/วัน' : 'Avg/Day'}
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-gray-600 hidden md:table-cell">
                      {language === 'th' ? 'ลงข้อมูลล่าสุด' : 'Last Entry'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.userStats.map((stat, index) => (
                    <TableRow key={stat.userId} className="border-gray-200/50 hover:bg-emerald-50/50 transition-colors">
                      <TableCell className="font-medium text-xs sm:text-sm py-3 text-gray-900">
                        <div className="flex items-center gap-2">
                          {index < 3 && (
                            <Badge 
                              className={`text-xs rounded-full ${
                                index === 0 
                                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0' 
                                  : index === 1 
                                    ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-white border-0'
                                    : 'bg-gradient-to-r from-amber-600 to-orange-700 text-white border-0'
                              }`}
                            >
                              #{index + 1}
                            </Badge>
                          )}
                          {stat.userName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 font-semibold">
                          {stat.totalSubmissions}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-gray-600 text-sm hidden sm:table-cell">
                        {stat.avgPerDay}
                      </TableCell>
                      <TableCell className="text-gray-500 text-xs hidden md:table-cell">
                        {stat.lastSubmission 
                          ? format(parseISO(stat.lastSubmission), 'MMM dd, yyyy HH:mm')
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
