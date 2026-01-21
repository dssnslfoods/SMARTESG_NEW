import { useEffect, useState } from 'react';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Clock,
  Calendar,
  Activity,
  BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays } from 'date-fns';

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
  const [userStats, setUserStats] = useState<UserSubmissionStats[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [peakHour, setPeakHour] = useState<{ hour: string; count: number } | null>(null);
  const [peakDay, setPeakDay] = useState<{ date: string; count: number } | null>(null);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      // Fetch all metric_value entries with created_at timestamp
      const { data: metricValues, error } = await supabase
        .from('metric_value')
        .select('value_id, submitted_by, created_at, status')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!metricValues || metricValues.length === 0) {
        setLoading(false);
        return;
      }

      setTotalEntries(metricValues.length);

      // Fetch user profiles for names
      const uniqueUserIds = [...new Set(metricValues.filter(m => m.submitted_by).map(m => m.submitted_by))] as string[];
      const { data: profiles } = await supabase
        .from('app_user_profile')
        .select('user_id, full_name')
        .in('user_id', uniqueUserIds);

      // Calculate user submission stats
      const userSubmissionMap = new Map<string, { count: number; dates: Date[] }>();
      
      metricValues.forEach(mv => {
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
        const profile = profiles?.find(p => p.user_id === key);
        const sortedDates = value.dates.sort((a, b) => a.getTime() - b.getTime());
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        
        // Calculate days between first and last submission (minimum 1 day)
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

      // Sort by total submissions descending
      userStatsArray.sort((a, b) => b.totalSubmissions - a.totalSubmissions);
      setUserStats(userStatsArray);

      // Calculate hourly distribution
      const hourlyMap = new Map<number, number>();
      for (let i = 0; i < 24; i++) {
        hourlyMap.set(i, 0);
      }

      metricValues.forEach(mv => {
        if (mv.created_at) {
          const hour = new Date(mv.created_at).getHours();
          hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
        }
      });

      const hourlyDataArray: HourlyData[] = [];
      let maxHour = { hour: 0, count: 0 };
      
      hourlyMap.forEach((count, hour) => {
        const label = `${hour.toString().padStart(2, '0')}:00`;
        hourlyDataArray.push({
          hour: hour.toString(),
          count,
          label,
        });
        if (count > maxHour.count) {
          maxHour = { hour, count };
        }
      });

      setHourlyData(hourlyDataArray);
      setPeakHour({ hour: `${maxHour.hour.toString().padStart(2, '0')}:00`, count: maxHour.count });

      // Calculate daily distribution (last 30 days)
      const dailyMap = new Map<string, number>();
      
      metricValues.forEach(mv => {
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

      // Sort by date
      dailyDataArray.sort((a, b) => a.date.localeCompare(b.date));
      
      // Take last 30 days
      const last30Days = dailyDataArray.slice(-30);
      setDailyData(last30Days);
      
      if (maxDay.date) {
        setPeakDay({ 
          date: format(parseISO(maxDay.date), 'MMM dd, yyyy'), 
          count: maxDay.count 
        });
      }

    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (totalEntries === 0) {
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

      {/* Peak Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
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
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{totalEntries}</div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'ผู้ใช้ที่ลงข้อมูล' : 'Active Users'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{userStats.length}</div>
          </CardContent>
        </Card>

        {/* Peak Hour */}
        <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl shadow-gray-900/5 hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-500">
                {language === 'th' ? 'ชั่วโมงยอดนิยม' : 'Peak Hour'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{peakHour?.hour || '-'}</div>
            <div className="text-xs text-gray-400 mt-1">
              {peakHour ? `${peakHour.count} ${language === 'th' ? 'รายการ' : 'entries'}` : ''}
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
                <Calendar className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 truncate">{peakDay?.date || '-'}</div>
            <div className="text-xs text-gray-400 mt-1">
              {peakDay ? `${peakDay.count} ${language === 'th' ? 'รายการ' : 'entries'}` : ''}
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
                <BarChart data={hourlyData}>
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
                    fill="url(#barGradient)" 
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
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
              {language === 'th' ? 'จำนวนรายการใน 30 วันล่าสุด' : 'Entries over the last 30 days'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
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
                {userStats.map((stat, index) => (
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
        </CardContent>
      </Card>
    </div>
  );
}
