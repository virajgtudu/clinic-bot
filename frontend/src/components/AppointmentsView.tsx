import { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  TrendingUp, 
  Search, 
  Calendar, 
  Loader2, 
  XCircle, 
  Settings 
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useDoctors } from '../hooks/useDoctors';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export function AppointmentsView() {
  const { profile } = useAuth();
  const { doctors } = useDoctors();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    } catch (err) {
      console.error(`Error updating status to ${newStatus}:`, err);
    }
  };

  const fetchAll = async () => {
    if (!profile?.clinic_id) return;
    setLoading(true);
    let query = supabase
      .from('appointments')
      .select('*, patients(patient_id_serial)')
      .eq('clinic_id', profile.clinic_id);
    
    if (startDate) query = query.gte('booking_date', startDate);
    if (endDate) query = query.lte('booking_date', endDate);

    const { data } = await query
      .order('booking_date', { ascending: false })
      .order('token', { ascending: false })
      .limit(200);
    
    if (data) setAppointments(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [profile?.clinic_id, startDate, endDate]);

  const stats = {
    total: appointments.length,
    completed: appointments.filter(a => a.status === 'Completed').length,
    today: appointments.filter(a => a.booking_date === new Date().toISOString().split('T')[0]).length
  };

  const filteredAppointments = appointments.filter(appt => {
    const pId = appt.patients?.patient_id_serial || '';
    const matchesSearch = appt.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          pId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || appt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDoctorName = (id: string) => {
    const doctor = doctors.find(d => d.id === id);
    return doctor ? doctor.name : (id || 'Unknown Doctor');
  };

  const getFormattedToken = (doctorName: string, tokenNum: number) => {
    const cleanName = doctorName.replace(/^Dr\.?\s+/i, '').trim();
    const parts = cleanName.split(' ');
    const prefix = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : cleanName.substring(0, 2).toUpperCase();
    return `${prefix}-${tokenNum.toString().padStart(3, '0')}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Viewed Records', value: stats.total, icon: <Activity className="text-brand-500" aria-hidden="true" />, sub: 'Matching filters' },
          { label: 'Completed Cases', value: stats.completed, icon: <CheckCircle2 className="text-emerald-500" aria-hidden="true" />, sub: `${Math.round((stats.completed/(stats.total || 1))*100)}% completion` },
          { label: "Today's Volume", value: stats.today, icon: <TrendingUp className="text-amber-500" aria-hidden="true" />, sub: 'Total slots booked' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h4 className="text-2xl font-black dark:text-white">{stat.value}</h4>
              <p className="text-[10px] text-slate-500 font-medium">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="p-10 border-b border-slate-50 dark:border-slate-800 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-black dark:text-white">Appointment History</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Comprehensive visit records and patient tracking</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
                <input 
                  id="historySearch"
                  name="search"
                  type="text" 
                  placeholder="Search Name or Patient ID…"
                  aria-label="Search by Patient Name or Patient ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-brand-500/20 w-64 transition-all outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <select 
                id="statusFilter"
                name="statusFilter"
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-500/20 cursor-pointer outline-none"
              >
                <option value="All">All Status</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Serving">Serving</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 p-6 bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl border border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-brand-500" aria-hidden="true" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Range Filter</span>
            </div>
            <div className="flex items-center gap-3">
              <input 
                id="startDate"
                name="startDate"
                aria-label="Start Date"
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500/20 outline-none cursor-pointer"
              />
              <span className="text-slate-400 text-xs font-bold">to</span>
              <input 
                id="endDate"
                name="endDate"
                aria-label="End Date"
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500/20 outline-none cursor-pointer"
              />
              {(startDate || endDate) && (
                <button 
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-[10px] font-black text-rose-500 uppercase hover:underline ml-2 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded px-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center"><Loader2 className="animate-spin text-brand-500 mx-auto" size={32} /></div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
                <Calendar size={32} aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-slate-400">No appointments found matching your criteria.</p>
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Patient Profile</th>
                  <th className="px-6 py-4">Visit ID</th>
                  <th className="px-6 py-4">Doctor</th>
                  <th className="px-6 py-4">Schedule</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt, idx) => {
                  const docName = getDoctorName(appt.doctor_id);
                  return (
                    <tr key={appt.id} className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl group transition-all hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 rounded-l-2xl text-[10px] font-black text-slate-400">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-black text-[10px]">
                            {appt.age || '??'}y
                          </div>
                          <div>
                            <p className="text-sm font-bold dark:text-white">{appt.patient_name}</p>
                            <p className="text-[10px] text-brand-500 font-black tracking-widest uppercase">ID: {appt.patients?.patient_id_serial || 'PENDING'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex flex-col">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200">{getFormattedToken(docName, appt.token)}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Daily Token</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-black uppercase text-slate-500">
                            {docName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{docName}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold dark:text-slate-300">{appt.booking_date}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{appt.booking_time || 'Regular Slot'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          appt.status === 'Completed' ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" : 
                          appt.status === 'Cancelled' ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400" : 
                          appt.status === 'Serving' ? "bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 animate-pulse" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                        )}>{appt.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right rounded-r-2xl relative">
                        <button 
                          onClick={() => setActiveMenuId(activeMenuId === appt.id ? null : appt.id)}
                          className="p-2 text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                          aria-label="Manage appointment"
                        >
                          <Settings size={16} aria-hidden="true" />
                        </button>
                        
                        {activeMenuId === appt.id && (
                          <>
                            {/* Backdrop for closing */}
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setActiveMenuId(null)}
                            />
                            {/* Dropdown Menu */}
                            <div className="absolute right-6 mt-1 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl z-20 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                              <button
                                onClick={async () => {
                                  await updateStatus(appt.id, 'Completed');
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-4 py-3 text-left text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center gap-2 transition-colors"
                              >
                                <CheckCircle2 size={14} aria-hidden="true" />
                                Mark Completed
                              </button>
                              <button
                                onClick={async () => {
                                  await updateStatus(appt.id, 'Cancelled');
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-4 py-3 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 transition-colors"
                              >
                                <XCircle size={14} aria-hidden="true" />
                                Cancel Appointment
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
