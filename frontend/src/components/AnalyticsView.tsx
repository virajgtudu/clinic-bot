import React, { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  Calendar, 
  Clock, 
  Activity, 
  UserX, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  Users, 
  Phone, 
  Loader2,
  Stethoscope
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type TimeRange = 'today' | '7d' | '30d';

interface AnalyticsData {
  totalBookings: number;
  totalBookingsTrend: number;
  avgWaitTime: number;
  avgWaitTimeTrend: number;
  complianceRate: number;
  complianceRateTrend: number;
  cancellationRate: number;
  cancellationRateTrend: number;
  
  peakTraffic: { name: string; value: number }[];
  channels: { name: string; count: number; percentage: number; icon: any; color: string }[];
  complianceTypeBreakdown: { name: string; rate: number; completed: number; total: number }[];
  doctorWorkload: { name: string; bookings: number }[];
}

// Helper: Get IST date with offset in YYYY-MM-DD
const getISTDateOffset = (offsetDays: number): string => {
  const date = new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5));
  istDate.setDate(istDate.getDate() - offsetDays);
  
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(istDate);
};

// Helper: Parse time string into hour bucket (9 AM to 5 PM)
const getHourBucket = (timeStr: string): string => {
  if (!timeStr) return '9 AM';
  try {
    const is12h = /am|pm/i.test(timeStr);
    let hour = 9;
    
    if (is12h) {
      const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        hour = h;
      }
    } else {
      const parts = timeStr.split(':');
      hour = parseInt(parts[0], 10);
    }
    
    if (hour <= 9) return '9 AM';
    if (hour === 10) return '10 AM';
    if (hour === 11) return '11 AM';
    if (hour === 12) return '12 PM';
    if (hour === 13) return '1 PM';
    if (hour === 14) return '2 PM';
    if (hour === 15) return '3 PM';
    if (hour === 16) return '4 PM';
    return '5 PM';
  } catch (e) {
    return '9 AM';
  }
};

// Helper: Calculate wait time for a single appointment
const calculateWaitTimeForAppt = (appt: any): number => {
  if (appt.status === 'Completed' || appt.status === 'completed') {
    // Standard estimated consultation duration logic based on token position
    return Math.max(5, (appt.token - 1) * 12);
  }
  
  if (appt.booking_time && appt.booking_date) {
    try {
      const match = appt.booking_time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      let hours = 9;
      let minutes = 0;
      
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      } else {
        const parts = appt.booking_time.split(':');
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
      }
      
      const [year, month, day] = appt.booking_date.split('-').map(Number);
      const start = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / (1000 * 60));
      return diff > 0 ? diff : 0;
    } catch (e) {
      // Fallback
    }
  }
  
  try {
    const start = new Date(appt.created_at).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / (1000 * 60));
    return diff > 0 ? diff : 0;
  } catch (e) {
    return 0;
  }
};

export function AnalyticsView() {
  const { profile } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const fetchAnalytics = async () => {
    if (!profile?.clinic_id) return;
    setLoading(true);

    try {
      const rangeDays = timeRange === 'today' ? 0 : timeRange === '7d' ? 7 : 30;
      const todayStr = getISTDateOffset(0);
      const currentStartStr = getISTDateOffset(rangeDays);
      const prevStartStr = getISTDateOffset(timeRange === 'today' ? 1 : rangeDays * 2);

      // 1. Fetch appointments spanning current + previous periods
      const { data: apptsData, error: apptsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('booking_date', prevStartStr)
        .lte('booking_date', todayStr);

      if (apptsError) throw apptsError;

      // 2. Fetch reminders spanning current + previous periods
      const { data: remsData, error: remsError } = await supabase
        .from('reminders')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('start_date', prevStartStr)
        .lte('start_date', todayStr);

      if (remsError) throw remsError;

      // 3. Fetch doctors to map names
      const { data: docsData, error: docsError } = await supabase
        .from('doctors')
        .select('id, name')
        .eq('clinic_id', profile.clinic_id);

      if (docsError) throw docsError;

      const appts = apptsData || [];
      const rems = remsData || [];
      const docs = docsData || [];

      // Split current vs previous
      const currentAppts = appts.filter(a => timeRange === 'today' ? a.booking_date === todayStr : a.booking_date >= currentStartStr);
      const prevAppts = appts.filter(a => timeRange === 'today' ? a.booking_date === getISTDateOffset(1) : (a.booking_date >= prevStartStr && a.booking_date < currentStartStr));

      const currentRems = rems.filter(r => timeRange === 'today' ? r.start_date === todayStr : r.start_date >= currentStartStr);
      const prevRems = rems.filter(r => timeRange === 'today' ? r.start_date === getISTDateOffset(1) : (r.start_date >= prevStartStr && r.start_date < currentStartStr));

      // Calculate Total Bookings & Trend
      const totalBookings = currentAppts.length;
      const prevBookings = prevAppts.length;
      const bookingsDiff = totalBookings - prevBookings;
      const totalBookingsTrend = prevBookings > 0 ? Math.round((bookingsDiff / prevBookings) * 100) : (totalBookings > 0 ? 100 : 0);

      // Calculate Average Wait Time & Trend (Only valid appointments)
      const currentValidAppts = currentAppts.filter(a => a.status !== 'Cancelled' && a.status !== 'cancelled');
      const prevValidAppts = prevAppts.filter(a => a.status !== 'Cancelled' && a.status !== 'cancelled');

      const currentAvgWait = currentValidAppts.length > 0
        ? Math.round(currentValidAppts.reduce((acc, a) => acc + calculateWaitTimeForAppt(a), 0) / currentValidAppts.length)
        : 0;
      const prevAvgWait = prevValidAppts.length > 0
        ? Math.round(prevValidAppts.reduce((acc, a) => acc + calculateWaitTimeForAppt(a), 0) / prevValidAppts.length)
        : 0;

      const waitDiff = currentAvgWait - prevAvgWait;
      const avgWaitTimeTrend = prevAvgWait > 0 ? Math.round((waitDiff / prevAvgWait) * 100) : 0;

      // Calculate Medication Compliance & Trend
      const getComplianceInfo = (remsList: any[]) => {
        const valid = remsList.filter(r => r.status === 'Completed' || r.status === 'Missed');
        const completed = valid.filter(r => r.status === 'Completed').length;
        return {
          rate: valid.length > 0 ? Math.round((completed / valid.length) * 100) : 100,
          completed,
          total: valid.length
        };
      };

      const currentComp = getComplianceInfo(currentRems);
      const prevComp = getComplianceInfo(prevRems);
      const complianceRate = currentComp.rate;
      const complianceRateTrend = complianceRate - prevComp.rate; // simple percentage point diff

      // Calculate Cancellation Rate & Trend
      const getCancellationRate = (apptsList: any[]) => {
        const total = apptsList.length;
        const cancelled = apptsList.filter(a => a.status === 'Cancelled' || a.status === 'cancelled').length;
        return total > 0 ? Math.round((cancelled / total) * 100) : 0;
      };

      const cancellationRate = getCancellationRate(currentAppts);
      const prevCancelRate = getCancellationRate(prevAppts);
      const cancellationRateTrend = cancellationRate - prevCancelRate; // simple percentage point diff

      // Hour buckets for Peak Traffic
      const hourBuckets: Record<string, number> = {
        '9 AM': 0, '10 AM': 0, '11 AM': 0, '12 PM': 0, '1 PM': 0, '2 PM': 0, '3 PM': 0, '4 PM': 0, '5 PM': 0
      };
      currentAppts.forEach(a => {
        const bucket = getHourBucket(a.booking_time);
        if (hourBuckets[bucket] !== undefined) {
          hourBuckets[bucket]++;
        }
      });
      const peakTraffic = Object.keys(hourBuckets).map(key => ({
        name: key,
        value: hourBuckets[key]
      }));

      // Booking channels breakdown
      const whatsappCount = currentAppts.filter(a => a.source === 'whatsapp').length;
      const walkinCount = currentAppts.filter(a => a.source === 'walkin' || a.source === 'walk-in').length;
      const callCount = currentAppts.filter(a => a.source === 'call').length;
      const totalSources = whatsappCount + walkinCount + callCount || 1;

      const channels = [
        { 
          name: 'WhatsApp Automated Bot', 
          count: whatsappCount, 
          percentage: Math.round((whatsappCount / totalSources) * 100),
          icon: MessageSquare,
          color: 'bg-emerald-500 text-emerald-500'
        },
        { 
          name: 'Walk-in / Front Desk', 
          count: walkinCount, 
          percentage: Math.round((walkinCount / totalSources) * 100),
          icon: Users,
          color: 'bg-blue-500 text-blue-500'
        },
        { 
          name: 'Direct Call / Telephonic', 
          count: callCount, 
          percentage: Math.round((callCount / totalSources) * 100),
          icon: Phone,
          color: 'bg-indigo-500 text-indigo-500'
        }
      ];

      // Compliance Breakdown by Type
      const getComplianceByType = (remsList: any[], type: 'medication' | 'test' | 'follow_up') => {
        const typeRems = remsList.filter(r => r.type === type && (r.status === 'Completed' || r.status === 'Missed'));
        const completed = typeRems.filter(r => r.status === 'Completed').length;
        return {
          rate: typeRems.length > 0 ? Math.round((completed / typeRems.length) * 100) : 100,
          completed,
          total: typeRems.length
        };
      };

      const medComp = getComplianceByType(currentRems, 'medication');
      const testComp = getComplianceByType(currentRems, 'test');
      const fupComp = getComplianceByType(currentRems, 'follow_up');

      const complianceTypeBreakdown = [
        { name: 'Medications', rate: medComp.rate, completed: medComp.completed, total: medComp.total },
        { name: 'Diagnostic Tests', rate: testComp.rate, completed: testComp.completed, total: testComp.total },
        { name: 'Follow-ups', rate: fupComp.rate, completed: fupComp.completed, total: fupComp.total }
      ];

      // Doctor workload comparison
      const doctorCounts: Record<string, number> = {};
      currentAppts.forEach(a => {
        doctorCounts[a.doctor_id] = (doctorCounts[a.doctor_id] || 0) + 1;
      });

      const doctorWorkload = docs.map(d => ({
        name: d.name.replace('Dr. ', ''),
        bookings: doctorCounts[d.id] || 0
      })).sort((a, b) => b.bookings - a.bookings);

      setData({
        totalBookings,
        totalBookingsTrend,
        avgWaitTime: currentAvgWait,
        avgWaitTimeTrend,
        complianceRate,
        complianceRateTrend,
        cancellationRate,
        cancellationRateTrend,
        peakTraffic,
        channels,
        complianceTypeBreakdown,
        doctorWorkload
      });
    } catch (err) {
      console.error('Failed to calculate analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, profile?.clinic_id]);

  const renderMetricCard = (
    label: string, 
    value: string | number, 
    trend: number, 
    trendText: string, 
    icon: React.ReactNode, 
    colorClass: string,
    isLowerBetter: boolean = false
  ) => {
    // Determine trend style
    const isNeutral = trend === 0;
    const isPositiveChange = trend > 0;
    const isGoodChange = isLowerBetter ? !isPositiveChange : isPositiveChange;
    
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all duration-300">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <h3 className="text-4xl font-black dark:text-white transition-transform duration-300 group-hover:scale-105 origin-left">{value}</h3>
          </div>
          <div className={`p-4 rounded-2xl ${colorClass} shadow-md`}>
            {icon}
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-6">
          {!isNeutral && (
            <div className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full ${
              isGoodChange 
                ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400' 
                : 'bg-rose-50 text-rose-500 dark:bg-rose-950/20 dark:text-rose-400'
            }`}>
              {isGoodChange ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {trend > 0 ? `+${trend}` : trend}%
            </div>
          )}
          <span className="text-[10px] font-bold text-slate-400">{trendText}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-40 gap-4">
        <Loader2 className="animate-spin text-brand-500" size={48} />
        <p className="text-sm font-bold text-slate-400">Compiling real-time practice stats...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[3rem] shadow-xl">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
          <Stethoscope size={32} />
        </div>
        <h3 className="text-lg font-black dark:text-white">No analytics compiled</h3>
        <p className="text-xs text-slate-400 max-w-sm">We couldn't compile analytics. Please make sure appointments are scheduled or reminders are active.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight">Practice Analytics</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Real-Time Performance Overview</p>
        </div>
        
        {/* Time selector */}
        <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl self-start sm:self-center">
          <button 
            onClick={() => setTimeRange('today')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              timeRange === 'today' 
                ? 'bg-white dark:bg-slate-900 text-brand-500 shadow-md' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Today
          </button>
          <button 
            onClick={() => setTimeRange('7d')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              timeRange === '7d' 
                ? 'bg-white dark:bg-slate-900 text-brand-500 shadow-md' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            7 Days
          </button>
          <button 
            onClick={() => setTimeRange('30d')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              timeRange === '30d' 
                ? 'bg-white dark:bg-slate-900 text-brand-500 shadow-md' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {renderMetricCard(
          "Total Appointments", 
          data.totalBookings, 
          data.totalBookingsTrend, 
          "vs previous period", 
          <Calendar size={24} className="text-white" />,
          "bg-blue-500 shadow-blue-500/20"
        )}
        
        {renderMetricCard(
          "Avg. Wait Time", 
          `${data.avgWaitTime}m`, 
          data.avgWaitTimeTrend, 
          "vs previous period", 
          <Clock size={24} className="text-white" />,
          "bg-orange-500 shadow-orange-500/20",
          true // lower wait time is better
        )}
        
        {renderMetricCard(
          "Medication Compliance", 
          `${data.complianceRate}%`, 
          data.complianceRateTrend, 
          "% point difference", 
          <Activity size={24} className="text-white" />,
          "bg-emerald-500 shadow-emerald-500/20"
        )}
        
        {renderMetricCard(
          "Cancellation Rate", 
          `${data.cancellationRate}%`, 
          data.cancellationRateTrend, 
          "% point difference", 
          <UserX size={24} className="text-white" />,
          "bg-rose-500 shadow-rose-500/20",
          true // lower cancellation rate is better
        )}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Peak Traffic Hour Bucket Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl group">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient Flow</p>
              <h4 className="text-lg font-black dark:text-white mt-1">Busiest Hours Analysis</h4>
            </div>
            <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-500 rounded-2xl group-hover:rotate-12 transition-transform duration-300">
              <Clock size={20} />
            </div>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.peakTraffic} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsColorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '16px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 12
                  }}
                  itemStyle={{ color: '#0ea5e9' }}
                  cursor={{ stroke: '#0ea5e9', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  name="Appointments"
                  stroke="#0ea5e9" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#analyticsColorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Circular Compliance breakdown */}
        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">WhatsApp Response Rate</p>
            <h4 className="text-lg font-black dark:text-white">Reminder Compliance</h4>
          </div>
          
          <div className="relative w-48 h-48 mx-auto my-6 transition-transform group-hover:scale-105 duration-500">
            <svg className="w-full h-full transform -rotate-90 filter drop-shadow-lg">
              <circle cx="96" cy="96" r="80" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="16" fill="none" />
              <circle 
                  cx="96" cy="96" r="80" 
                  className="stroke-brand-500" 
                  strokeWidth="16" 
                  fill="none" 
                  strokeDasharray={502} 
                  strokeDashoffset={502 * (1 - data.complianceRate / 100)} 
                  strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black dark:text-white bg-clip-text text-transparent bg-gradient-to-br from-brand-600 to-emerald-500">{data.complianceRate}%</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">Patient Compliance</span>
            </div>
          </div>
          
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium leading-relaxed">
            {data.complianceRate >= 85 
              ? "Excellent compliance! Automated reminders are driving healthy patient outcomes." 
              : "Room for improvement. Patient responses to WhatsApp reminders are moderate."}
          </p>
        </div>
      </div>

      {/* Secondary Metrics / Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Booking Channels Progress Bars */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Acquisition Mix</p>
            <h4 className="text-lg font-black dark:text-white mb-8">Booking Channels</h4>
          </div>
          
          <div className="space-y-6">
            {data.channels.map((chan) => {
              const IconComp = chan.icon;
              return (
                <div key={chan.name} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500 flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg ${chan.color.replace('text-', 'bg-').split(' ')[0]} bg-opacity-10 ${chan.color.split(' ')[1]}`}>
                        <IconComp size={14} />
                      </span>
                      {chan.name}
                    </span>
                    <span className="dark:text-white font-black">{chan.percentage}% <span className="text-slate-400 text-[10px]">({chan.count})</span></span>
                  </div>
                  <div className="w-full h-3 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${chan.color.split(' ')[0]}`} 
                      style={{ width: `${chan.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Doctor workload comparison */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Resource allocation</p>
            <h4 className="text-lg font-black dark:text-white mb-8">Consultations by Doctor</h4>
          </div>

          {data.doctorWorkload.length === 0 ? (
            <div className="py-10 text-center text-xs font-bold text-slate-400">No active doctors loaded.</div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.doctorWorkload} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: 'none', 
                      borderRadius: '16px',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 12
                    }}
                    cursor={{ fill: 'rgba(14, 165, 233, 0.05)' }}
                  />
                  <Bar dataKey="bookings" name="Appointments" radius={[8, 8, 0, 0]}>
                    {data.doctorWorkload.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? '#0ea5e9' : index === 1 ? '#6366f1' : '#8b5cf6'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Compliance breakdown table */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Detailed Patient Response</p>
            <h4 className="text-lg font-black dark:text-white mb-6">Reminder Category Mix</h4>
          </div>

          <div className="space-y-5">
            {data.complianceTypeBreakdown.map((row) => (
              <div key={row.name} className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-bold dark:text-white">{row.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{row.completed} of {row.total} responded</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1.5 rounded-xl text-xs font-black ring-1 ${
                    row.rate >= 85 
                      ? 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/50' 
                      : row.rate >= 60 
                        ? 'bg-orange-50 text-orange-600 ring-orange-100 dark:bg-orange-950/20 dark:text-orange-400 dark:ring-orange-900/30'
                        : 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:ring-rose-900/30'
                  }`}>
                    {row.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
    </div>
  );
}
