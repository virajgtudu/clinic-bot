import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Pill, 
  FileText, 
  Calendar, 
  Trash2, 
  CheckCircle2, 
  Clock,
  Activity,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useReminders } from '../hooks/useReminders';
import type { Reminder } from '../hooks/useReminders';
import { CreateReminderModal } from './CreateReminderModal';

export function RemindersView() {
  const { reminders = [], analytics, loading, cancelReminder, addReminder, updateReminderStatus } = useReminders();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'medication' | 'test' | 'follow_up' | 'today_follow_up'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [renderError, setRenderError] = useState<string | null>(null);

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  // Ensure reminders is always an array before filtering
  const safeReminders = Array.isArray(reminders) ? reminders : [];

  // Defensive filtering logic
  let filteredReminders: Reminder[] = [];
  try {
    filteredReminders = safeReminders.filter((r: Reminder) => {
      if (!r) return false;
      if (filter === 'today_follow_up') {
        return r.type === 'follow_up' && r.start_date === todayStr && (r.status === 'Active' || r.status === 'Missed');
      }
      const matchesFilter = filter === 'all' || r.type === filter;
      const patientName = r.patient_name || '';
      const itemName = r.item_name || '';
      const matchesSearch = patientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         itemName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  } catch (err: any) {
    console.error('Filtering error:', err);
    if (!renderError) setRenderError(err.message);
  }
  const handleManualRemind = async (reminder: Reminder) => {
    if (!reminder) return;
    try {
      // Determine API URL based on where frontend is running. If no VITE_API_URL is set,
      // fallback to localhost:5000 for local dev or use the same host for production
      const apiUrl = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://' + window.location.host);

      const messageType = reminder.type.replace('_', ' ');
      const message = `🔄 Reminder: Hi ${reminder.patient_name || 'Patient'}, this is a manual reminder for your ${messageType} regarding ${reminder.item_name}.`;

      const response = await fetch(`${apiUrl}/webhook/manual-remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: reminder.clinic_id,
          phone: reminder.patient_phone,
          message: message
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send reminder via API');
      }

      alert(`✅ Reminder successfully sent to ${reminder.patient_name || 'Patient'}!`);
    } catch (err) {
      console.error('Manual remind error:', err);
      alert('❌ Failed to send WhatsApp reminder. Please make sure the backend is running and the 24-hour limit hasn\'t passed.');
    }
  };

  if (renderError) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-rose-50 dark:bg-rose-950/20 rounded-[3rem] border border-rose-100 dark:border-rose-900/30">
        <AlertCircle size={48} className="text-rose-500 mb-4" />
        <h3 className="text-xl font-black text-rose-900 dark:text-rose-400">Component Error</h3>
        <p className="text-sm text-rose-600 dark:text-rose-500/70 font-medium mt-2">{renderError}</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-rose-500 text-white font-bold rounded-xl active:scale-95">Reload Dashboard</button>
      </div>
    );
  }

  // If loading and no data, show spinner
  if (loading && (!reminders || reminders.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-20 animate-in fade-in duration-700">
        <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold">Synchronizing reminders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight">PATIENT REMINDERS</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage automated medication, test, and follow-up alerts.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-6 py-4 rounded-2xl font-black transition-all shadow-lg shadow-brand-500/25 active:scale-95"
        >
          <Plus size={20} strokeWidth={3} />
          <span>CREATE REMINDER</span>
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnalyticsCard 
          label="Active Medications" 
          value={analytics?.medicationCount || 0} 
          icon={<Pill size={24} />} 
          color="blue"
          trend="+12%"
        />
        <AnalyticsCard 
          label="Upcoming Tests" 
          value={analytics?.testCount || 0} 
          icon={<FileText size={24} />} 
          color="emerald"
          trend="+5%"
        />
        <AnalyticsCard 
          label="Follow-ups" 
          value={analytics?.followUpCount || 0} 
          icon={<Calendar size={24} />} 
          color="purple"
          trend="0%"
        />
        <AnalyticsCard 
          label="Avg Compliance" 
          value={`${analytics?.complianceRate || 100}%`} 
          icon={<TrendingUp size={24} />} 
          color="orange"
          trend="+2.4%"
        />
      </div>

      {/* Filters & Table */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl w-fit">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
            <FilterButton active={filter === 'medication'} onClick={() => setFilter('medication')} label="Medications" />
            <FilterButton active={filter === 'test'} onClick={() => setFilter('test')} label="Tests" />
            <FilterButton active={filter === 'follow_up'} onClick={() => setFilter('follow_up')} label="Follow-ups" />
            <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-2" />
            <FilterButton 
              active={filter === 'today_follow_up'} 
              onClick={() => setFilter('today_follow_up')} 
              label="Today's Follow-ups" 
              count={safeReminders.filter((r: Reminder) => r?.type === 'follow_up' && r?.start_date === todayStr && (r?.status === 'Active' || r?.status === 'Missed')).length}
            />
          </div>

          <div className="relative group min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search patient or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-3.5 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 dark:text-white placeholder:text-slate-400 font-medium transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/50">
                <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Patient</th>
                <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Type & Item</th>
                <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Schedule</th>
                <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
                      <p className="text-slate-500 font-medium">Loading reminders...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredReminders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <Activity size={48} />
                      <p className="text-xl font-bold">No reminders found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReminders.map((reminder) => (
                  <tr key={reminder.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500">
                          {reminder.patient_name ? (reminder.patient_name[0] || '?').toUpperCase() : '?'}
                        </div>
                        <div>
                          <div className="font-bold dark:text-white">{reminder.patient_name || 'Unknown Patient'}</div>
                          <div className="text-sm text-slate-500 font-medium">{reminder.patient_phone || 'No Phone'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <ReminderIcon type={reminder.type} />
                        <div>
                          <div className="font-bold dark:text-white">{reminder.item_name}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-tight">{reminder.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-bold dark:text-slate-300">
                          <Clock size={14} className="text-brand-500" />
                          {reminder.frequency || 'N/A'}
                        </div>
                        <div className="flex gap-1">
                          {(reminder.times || []).map((t, i) => (
                            <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md font-bold text-slate-500">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-bold dark:text-slate-300">{reminder.duration_days} Days</div>
                      <div className="text-xs text-slate-400 font-medium">{reminder.start_date} → {reminder.end_date}</div>
                    </td>
                    <td className="px-8 py-6">
                      <StatusBadge status={reminder.status} />
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {filter === 'today_follow_up' && (
                          <>
                            <button 
                              onClick={() => handleManualRemind(reminder)}
                              className="px-3 py-1.5 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase rounded-lg hover:bg-brand-500 hover:text-white transition-all"
                            >
                              Remind
                            </button>
                            <button 
                              onClick={() => updateReminderStatus(reminder.id, 'Completed')}
                              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase rounded-lg hover:bg-emerald-500 hover:text-white transition-all"
                            >
                              Complete
                            </button>
                            <button 
                              onClick={() => updateReminderStatus(reminder.id, 'Missed')}
                              className="px-3 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase rounded-lg hover:bg-rose-500 hover:text-white transition-all"
                            >
                              Missed
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => {
                            if (confirm('Cancel this reminder?')) cancelReminder(reminder.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateReminderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={addReminder}
      />
    </div>
  );
}

function AnalyticsCard({ label, value, icon, color, trend }: { label: string, value: string | number, icon: React.ReactNode, color: string, trend: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
    purple: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
    orange: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 p-8 rounded-[2rem] shadow-sm hover:scale-[1.02] transition-transform duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className={cn("p-4 rounded-2xl", colors[color])}>
          {icon}
        </div>
        <div className="flex items-center gap-1 text-emerald-500 font-black text-sm bg-emerald-500/10 px-2 py-1 rounded-lg">
          <TrendingUp size={14} />
          {trend}
        </div>
      </div>
      <div>
        <div className="text-4xl font-black dark:text-white mb-1">{value}</div>
        <div className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label, count }: { active: boolean, onClick: () => void, label: string, count?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2",
        active 
          ? "bg-white dark:bg-slate-700 text-brand-500 shadow-sm" 
          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[10px]",
          active ? "bg-brand-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function ReminderIcon({ type }: { type: Reminder['type'] }) {
  const icons = {
    medication: <Pill size={18} className="text-blue-500" />,
    test: <FileText size={18} className="text-emerald-500" />,
    follow_up: <Calendar size={18} className="text-purple-500" />
  };
  
  const bgColors = {
    medication: 'bg-blue-50 dark:bg-blue-500/10',
    test: 'bg-emerald-50 dark:bg-emerald-500/10',
    follow_up: 'bg-purple-50 dark:bg-purple-500/10'
  };

  return (
    <div className={cn("p-2.5 rounded-xl", bgColors[type])}>
      {icons[type]}
    </div>
  );
}

function StatusBadge({ status }: { status: Reminder['status'] }) {
  const configs = {
    Active: { color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', icon: <Activity size={12} /> },
    Cancelled: { color: 'text-slate-400 bg-slate-50 dark:bg-slate-800', icon: <AlertCircle size={12} /> },
    Completed: { color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10', icon: <CheckCircle2 size={12} /> },
    Missed: { color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10', icon: <AlertCircle size={12} /> }
  };

  const config = configs[status];

  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider w-fit", config.color)}>
      {config.icon}
      {status}
    </div>
  );
}
