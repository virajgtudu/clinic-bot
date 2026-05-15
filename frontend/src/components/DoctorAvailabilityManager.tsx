import { useState, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  X, 
  ChevronDown, 
  Calendar, 
  Activity, 
  AlertCircle,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  PauseCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useDoctors } from '../hooks/useDoctors';

type Session = { start: string; end: string };
type DayConfig = { enabled: boolean; sessions: Session[] };
type AvailabilityV2 = {
  version: "2.0";
  weekly: Record<string, DayConfig>;
  consultation_duration: number;
  advanced: {
    max_patients_per_day: number;
    emergency_buffer: number;
    gap_buffer: number;
    blocked_dates: string[];
  };
};

const DEFAULT_AVAILABILITY: AvailabilityV2 = {
  version: "2.0",
  weekly: {
    monday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
    tuesday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
    wednesday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
    thursday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
    friday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
    saturday: { enabled: false, sessions: [] },
    sunday: { enabled: false, sessions: [] },
  },
  consultation_duration: 15,
  advanced: {
    max_patients_per_day: 40,
    emergency_buffer: 2,
    gap_buffer: 5,
    blocked_dates: [],
  }
};

const TIME_OPTIONS = [
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM"
];

export function DoctorAvailabilityManager() {
  const { doctors, loading, updateDoctor } = useDoctors();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityV2>(DEFAULT_AVAILABILITY);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'advanced'>('weekly');

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  useEffect(() => {
    if (selectedDoctor) {
      const avail = selectedDoctor.availability_json;
      if (avail && avail.version === "2.0") {
        setAvailability(avail);
      } else {
        // Migration logic from old format or empty
        setAvailability({
          ...DEFAULT_AVAILABILITY,
          weekly: Object.keys(DEFAULT_AVAILABILITY.weekly).reduce((acc, day) => {
            const oldDay = avail?.[day];
            if (oldDay) {
              acc[day] = {
                enabled: oldDay.enabled ?? true,
                sessions: oldDay.slots?.length > 1 
                  ? [{ start: oldDay.slots[0], end: oldDay.slots[oldDay.slots.length - 1] }]
                  : DEFAULT_AVAILABILITY.weekly[day as keyof typeof DEFAULT_AVAILABILITY.weekly].sessions
              };
            } else {
              acc[day] = DEFAULT_AVAILABILITY.weekly[day as keyof typeof DEFAULT_AVAILABILITY.weekly];
            }
            return acc;
          }, {} as Record<string, DayConfig>)
        });
      }
    }
  }, [selectedDoctorId]);

  const handleSave = async () => {
    if (!selectedDoctorId) return;
    setIsSaving(true);
    try {
      await updateDoctor(selectedDoctorId, { availability_json: availability });
      alert('Availability updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update availability.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateDay = (day: string, config: Partial<DayConfig>) => {
    setAvailability(prev => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [day]: { ...prev.weekly[day], ...config }
      }
    }));
  };

  const addSession = (day: string) => {
    const sessions = [...availability.weekly[day].sessions];
    const lastSession = sessions[sessions.length - 1];
    let newStart = "05:00 PM";
    let newEnd = "08:00 PM";
    
    if (lastSession) {
      // Try to suggest a later time
      const lastEndIdx = TIME_OPTIONS.indexOf(lastSession.end);
      if (lastEndIdx !== -1 && lastEndIdx < TIME_OPTIONS.length - 4) {
        newStart = TIME_OPTIONS[lastEndIdx + 2];
        newEnd = TIME_OPTIONS[lastEndIdx + 6] || TIME_OPTIONS[TIME_OPTIONS.length - 1];
      }
    }

    updateDay(day, { sessions: [...sessions, { start: newStart, end: newEnd }] });
  };

  const removeSession = (day: string, index: number) => {
    const sessions = availability.weekly[day].sessions.filter((_, i) => i !== index);
    updateDay(day, { sessions });
  };

  const updateSession = (day: string, index: number, field: keyof Session, value: string) => {
    const sessions = [...availability.weekly[day].sessions];
    sessions[index] = { ...sessions[index], [field]: value };
    updateDay(day, { sessions });
  };

  const copyToAll = (sourceDay: string) => {
    const sourceConfig = availability.weekly[sourceDay];
    const newWeekly = { ...availability.weekly };
    Object.keys(newWeekly).forEach(day => {
      if (day !== 'saturday' && day !== 'sunday') {
        newWeekly[day] = { ...sourceConfig };
      }
    });
    setAvailability(prev => ({ ...prev, weekly: newWeekly }));
  };

  if (loading) return <div className="p-20 text-center"><div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto" /></div>;

  if (!selectedDoctorId && doctors.length > 0) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black dark:text-white tracking-tight">DOCTOR AVAILABILITY</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Select a doctor to manage their weekly schedule and session timings.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {doctors.map(doc => (
            <button 
              key={doc.id} 
              onClick={() => setSelectedDoctorId(doc.id)}
              className="bg-white dark:bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 text-left hover:scale-[1.02] transition-all group shadow-sm hover:shadow-xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-6 group-hover:scale-110 transition-transform">
                <Stethoscope size={32} />
              </div>
              <h4 className="text-xl font-black dark:text-white">{doc.name}</h4>
              <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mt-1 mb-6">{doc.specialty}</p>
              
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800/50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manage Schedule</span>
                <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedDoctor) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header with Doctor Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setSelectedDoctorId(null)}
            className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-brand-500/20">
              {selectedDoctor.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-3xl font-black dark:text-white tracking-tight uppercase">{selectedDoctor.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-bold text-brand-500 uppercase tracking-widest">{selectedDoctor.specialty}</span>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <ShieldCheck size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Available</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-lg shadow-brand-500/25 active:scale-95"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Check size={20} strokeWidth={3} />}
          <span>SAVE CHANGES</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Main Configuration Area */}
        <div className="xl:col-span-8 space-y-8">
          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-[3rem] overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-500/10 rounded-xl text-brand-500">
                  <Calendar size={20} />
                </div>
                <h3 className="text-xl font-black dark:text-white tracking-tight">Weekly Availability</h3>
              </div>
              
              <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl">
                <TabButton active={activeTab === 'weekly'} onClick={() => setActiveTab('weekly')} label="Schedule" />
                <TabButton active={activeTab === 'advanced'} onClick={() => setActiveTab('advanced')} label="Advanced" />
              </div>
            </div>

            <div className="p-8">
              {activeTab === 'weekly' ? (
                <div className="space-y-6">
                  {Object.entries(availability.weekly).map(([day, config]) => (
                    <DayScheduleRow 
                      key={day} 
                      day={day} 
                      config={config} 
                      onUpdate={(updates: any) => updateDay(day, updates)}
                      onAddSession={() => addSession(day)}
                      onRemoveSession={(idx: number) => removeSession(day, idx)}
                      onUpdateSession={(idx: number, f: keyof Session, v: string) => updateSession(day, idx, f, v)}
                      onCopy={() => copyToAll(day)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Consultation Duration</label>
                      <div className="relative group">
                        <select 
                          value={availability.consultation_duration}
                          onChange={(e) => setAvailability(prev => ({ ...prev, consultation_duration: Number(e.target.value) }))}
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold dark:text-white appearance-none cursor-pointer focus:ring-2 focus:ring-brand-500/20 transition-all"
                        >
                          {[5, 10, 15, 20, 30, 45, 60].map(v => (
                            <option key={v} value={v}>{v} Minutes</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:rotate-180 transition-transform" size={16} />
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium ml-1 flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-brand-500" />
                        Slots are auto-generated based on this duration.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Max Patients / Day</label>
                      <input 
                        type="number" 
                        value={availability.advanced.max_patients_per_day}
                        onChange={(e) => setAvailability(prev => ({ ...prev, advanced: { ...prev.advanced, max_patients_per_day: Number(e.target.value) } }))}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold dark:text-white focus:ring-2 focus:ring-brand-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <AdvancedOption 
                      label="Emergency Buffer" 
                      description="Reserved slots for urgent cases" 
                      value={availability.advanced.emergency_buffer} 
                      onChange={(v) => setAvailability(prev => ({ ...prev, advanced: { ...prev.advanced, emergency_buffer: v } }))} 
                    />
                    <AdvancedOption 
                      label="Gap Buffer (Mins)" 
                      description="Cleaning/Rest time between appointments" 
                      value={availability.advanced.gap_buffer} 
                      onChange={(v) => setAvailability(prev => ({ ...prev, advanced: { ...prev.advanced, gap_buffer: v } }))} 
                    />
                  </div>

                  <div className="pt-8 border-t border-slate-100 dark:border-slate-800/50">
                    <h4 className="text-sm font-black dark:text-white uppercase tracking-widest mb-6">Vacation Mode / Block Dates</h4>
                    <div className="flex flex-wrap gap-3">
                      {availability.advanced.blocked_dates.map((date, i) => (
                        <div key={i} className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-500 rounded-xl font-bold text-xs">
                          {date}
                          <button onClick={() => setAvailability(prev => ({ ...prev, advanced: { ...prev.advanced, blocked_dates: prev.advanced.blocked_dates.filter((_, idx) => i !== idx) } }))}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const date = prompt("Enter date (YYYY-MM-DD):");
                          if (date) setAvailability(prev => ({ ...prev, advanced: { ...prev.advanced, blocked_dates: [...prev.advanced.blocked_dates, date] } }));
                        }}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:text-brand-500 hover:border-brand-500/50 rounded-xl font-bold text-xs transition-all"
                      >
                        <Plus size={14} /> Add Blocked Date
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Analytics & Preview */}
        <div className="xl:col-span-4 space-y-8">
          <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-10 rounded-[3rem] text-white shadow-xl shadow-brand-500/20 relative overflow-hidden group">
            <Activity className="absolute -right-10 -bottom-10 w-64 h-64 text-white/5 group-hover:rotate-12 transition-transform duration-1000" />
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-brand-100 mb-8">Capacity Analytics</h4>
            
            <div className="space-y-8 relative z-10">
              <div>
                <p className="text-5xl font-black tracking-tight">{calculateTotalSlots(availability)}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-100 mt-2">Total Weekly Slots</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xl font-black">~{Math.round(calculateTotalSlots(availability) * 0.8)}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-brand-100 mt-1">Avg capacity</p>
                </div>
                <div>
                  <p className="text-xl font-black">{availability.consultation_duration}m</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-brand-100 mt-1">Per patient</p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest">WhatsApp Booking</p>
                    <p className="text-[11px] font-medium text-brand-100">Live dynamic slots enabled</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <h4 className="text-sm font-black dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Clock size={16} className="text-brand-500" />
              Today's Preview
            </h4>
            
            <div className="space-y-4">
              {getCurrentDaySchedule(availability).enabled ? (
                <>
                  {getCurrentDaySchedule(availability).sessions.map((s, i) => (
                    <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold dark:text-white">{s.start} - {s.end}</span>
                      <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest">Active</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 font-bold text-center mt-4">Next available: 09:00 AM</p>
                </>
              ) : (
                <div className="p-10 text-center space-y-3">
                  <PauseCircle size={32} className="text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Doctor is off-duty today</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayScheduleRow({ day, config, onUpdate, onAddSession, onRemoveSession, onUpdateSession, onCopy }: any) {
  const isWeekend = day === 'saturday' || day === 'sunday';

  return (
    <div className={cn(
      "flex flex-col lg:flex-row lg:items-start gap-4 p-6 rounded-3xl transition-all border-2",
      config.enabled 
        ? "bg-white dark:bg-slate-800/20 border-slate-50 dark:border-slate-800/50" 
        : "bg-slate-50/50 dark:bg-slate-900/20 border-transparent opacity-60"
    )}>
      <div className="flex items-center gap-4 w-40 shrink-0 mt-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={config.enabled} 
            onChange={(e) => onUpdate({ enabled: e.target.checked })} 
          />
          <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
        </label>
        <span className={cn("text-sm font-black uppercase tracking-widest", config.enabled ? "dark:text-white" : "text-slate-400")}>{day.substring(0, 3)}</span>
      </div>

      <div className="flex-1 space-y-3">
        {!config.enabled ? (
          <div className="h-14 flex items-center">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Closed / Off-duty</span>
          </div>
        ) : (
          <div className="space-y-3">
            {config.sessions.map((session: Session, i: number) => (
              <div key={i} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                <TimeSelect value={session.start} onChange={(v) => onUpdateSession(i, 'start', v)} />
                <div className="w-4 h-[2px] bg-slate-200 dark:bg-slate-700" />
                <TimeSelect value={session.end} onChange={(v) => onUpdateSession(i, 'end', v)} />
                
                <div className="flex items-center gap-1 ml-2">
                  <button 
                    onClick={() => onRemoveSession(i)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                  {i === 0 && !isWeekend && (
                    <button 
                      onClick={onCopy}
                      className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-xl transition-all"
                      title="Duplicate to Mon-Fri"
                    >
                      <Copy size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button 
              onClick={onAddSession}
              className="flex items-center gap-2 text-[10px] font-black text-brand-500 uppercase tracking-widest hover:underline pt-2"
            >
              <Plus size={14} /> Add Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <div className="relative group min-w-[120px]">
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-4 pr-10 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold dark:text-white appearance-none cursor-pointer focus:ring-2 focus:ring-brand-500/20 transition-all"
      >
        {TIME_OPTIONS.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:rotate-180 transition-transform" size={14} />
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all",
        active 
          ? "bg-white dark:bg-slate-700 text-brand-500 shadow-sm shadow-black/5" 
          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      )}
    >
      {label}
    </button>
  );
}

function AdvancedOption({ label, description, value, onChange }: { label: string, description: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border border-slate-100 dark:border-slate-800/50 space-y-4">
      <div>
        <p className="text-xs font-black dark:text-white uppercase tracking-wider">{label}</p>
        <p className="text-[10px] text-slate-500 font-medium">{description}</p>
      </div>
      <input 
        type="range" min="0" max="60" step="5"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
      />
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase">Current: {value}</span>
      </div>
    </div>
  );
}

// Helpers
function calculateTotalSlots(avail: AvailabilityV2) {
  let total = 0;
  Object.values(avail.weekly).forEach(day => {
    if (!day.enabled) return;
    day.sessions.forEach(session => {
      const start = TIME_OPTIONS.indexOf(session.start);
      const end = TIME_OPTIONS.indexOf(session.end);
      if (start !== -1 && end !== -1 && end > start) {
        const totalMinutes = (end - start) * 30; // 30 min intervals in TIME_OPTIONS
        total += Math.floor(totalMinutes / avail.consultation_duration);
      }
    });
  });
  return total;
}

function getCurrentDaySchedule(avail: AvailabilityV2) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[new Date().getDay()];
  return avail.weekly[dayName] || { enabled: false, sessions: [] };
}
