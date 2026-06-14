import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  Calendar, 
  Phone, 
  Clock, 
  User,
  ArrowUpRight,
  Activity,
  History,
  X,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { usePatients } from '../hooks/usePatients';
import type { PatientRecord } from '../hooks/usePatients';
import { useDoctors } from '../hooks/useDoctors';
import { useReminders } from '../hooks/useReminders';
import { useAuth } from './AuthContext';
import { FollowUpModal } from './FollowUpModal';

export function PatientsView() {
  const { patients, loading, stats, fetchPatients, getPatientHistory } = usePatients();
  const { doctors } = useDoctors();
  const { addReminder } = useReminders();
  const { profile } = useAuth();
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);

  const getDoctorName = (id: string) => {
    const doctor = doctors.find(d => d.id === id);
    return doctor ? doctor.name : (id || 'Primary Physician');
  };

  const handleSendWhatsApp = async () => {
    if (!selectedPatient) return;
    const message = prompt(
      `Enter custom WhatsApp message to send to ${selectedPatient.name}:`,
      `Hello ${selectedPatient.name}, this is a message from ${profile?.full_name || 'ClinicPRO'}.`
    );
    if (!message) return;

    try {
      const rawApiUrl = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://' + window.location.host);
      const apiUrl = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

      const endpoint = `${apiUrl}/webhook/manual-remind`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: selectedPatient.clinic_id || profile?.clinic_id,
          phone: selectedPatient.phone,
          message: message
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      alert(`✅ Message successfully sent to ${selectedPatient.name}!`);
    } catch (err: any) {
      console.error('Send WhatsApp error:', err);
      alert(`❌ Failed to send WhatsApp message.\n\nError Details: ${err.message}`);
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchPatients(searchTerm);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const handlePatientClick = async (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setLoadingHistory(true);
    try {
      const data = await getPatientHistory(patient.id);
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 relative">
      {/* Overview Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard 
          label="Total Database" 
          value={stats.total} 
          sub="Registered Patients"
          icon={<Users size={24} />} 
          color="blue"
        />
        <StatCard 
          label="New This Month" 
          value={stats.newThisMonth} 
          sub="Patient Growth"
          icon={<User size={24} />} 
          color="emerald"
        />
        <StatCard 
          label="Active This Week" 
          value={stats.activeThisWeek} 
          sub="Patient Traffic"
          icon={<Activity size={24} />} 
          color="purple"
        />
      </div>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-[3rem] overflow-hidden shadow-sm">
        {/* Filter Bar */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50/30 dark:bg-slate-900/30">
          <div>
            <h3 className="text-xl font-black dark:text-white tracking-tight">Patient Directory</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Medical Records & Visit History</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative group min-w-[320px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search by Name, ID, or Phone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-6 py-3.5 bg-white dark:bg-slate-800 border-none rounded-2xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-brand-500/20 transition-all dark:text-white outline-none"
              />
            </div>
            
            <button className="p-3.5 bg-white dark:bg-slate-800 text-slate-500 hover:text-brand-500 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all active:scale-95">
              <Filter size={20} />
            </button>
            
            <button className="flex items-center gap-2 px-6 py-3.5 bg-brand-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 active:scale-95">
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="p-4 overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-500">Retrieving records...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300 mx-auto">
                <Search size={40} />
              </div>
              <p className="text-slate-400 font-bold">No patients found in your records.</p>
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <th className="px-6 py-4">Patient Profile</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Visits</th>
                  <th className="px-6 py-4">Last Consult</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <motion.tr 
                    layout
                    key={p.id} 
                    onClick={() => handlePatientClick(p)}
                    className="group bg-white dark:bg-slate-900/40 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 rounded-2xl transition-all cursor-pointer ring-1 ring-slate-100 dark:ring-slate-800/50 hover:ring-brand-500/30"
                  >
                    <td className="px-6 py-5 rounded-l-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-500 font-black text-sm shadow-sm group-hover:scale-110 transition-transform">
                          {p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 dark:text-white group-hover:text-brand-600 transition-colors">{p.name}</p>
                          <p className="text-[10px] text-brand-500 font-black uppercase tracking-widest mt-0.5">{p.patient_id_serial || 'PID-PENDING'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{p.phone}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{p.age} years old</p>
                    </td>
                    <td className="px-6 py-5">
                       <StatusBadge date={p.last_visit} />
                    </td>
                    <td className="px-6 py-5 text-center">
                       <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-black text-slate-600 dark:text-slate-400">
                         {p.visit_count}
                       </span>
                    </td>
                    <td className="px-6 py-5">
                       <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(p.last_visit!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                       <p className="text-[10px] text-slate-400 font-medium">{new Date(p.last_visit!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-6 py-5 rounded-r-2xl text-right">
                       <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-brand-500 transition-all group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 mx-auto">
                         <ChevronRight size={18} strokeWidth={3} />
                       </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Slide Panel */}
      <AnimatePresence>
        {selectedPatient && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedPatient(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-full max-w-2xl bg-white dark:bg-slate-950 shadow-2xl z-[101] overflow-hidden flex flex-col"
            >
              {/* Panel Header */}
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-brand-500/5 to-transparent">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[2rem] bg-brand-500 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-brand-500/30">
                    {selectedPatient.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black dark:text-white tracking-tight">{selectedPatient.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-black text-brand-500 uppercase tracking-widest">{selectedPatient.patient_id_serial}</span>
                      <div className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-xs font-bold text-slate-500">{selectedPatient.age} Years</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPatient(null)}
                  className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                {/* Contact Quick Info */}
                <div className="grid grid-cols-2 gap-6">
                  <InfoItem label="Primary Contact" value={selectedPatient.phone} icon={<Phone size={14} />} />
                  <InfoItem label="Registered Date" value={new Date(selectedPatient.created_at).toLocaleDateString()} icon={<Calendar size={14} />} />
                </div>

                {/* History Timeline */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <History className="text-brand-500" size={18} />
                       <h4 className="text-sm font-black dark:text-white uppercase tracking-widest">Consultation Timeline</h4>
                     </div>
                     <span className="text-[10px] font-bold text-slate-400">{history.length} Visits Found</span>
                   </div>

                   <div className="space-y-4">
                     {loadingHistory ? (
                       <div className="py-10 text-center space-y-4">
                         <Loader2 className="animate-spin text-brand-500 mx-auto" size={24} />
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading clinical history...</p>
                       </div>
                     ) : history.length === 0 ? (
                       <div className="py-10 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No previous visits recorded</p>
                       </div>
                     ) : (
                       history.map((h, i) => (
                         <div key={h.id} className="relative pl-8 pb-4">
                           {i !== history.length - 1 && <div className="absolute left-[11px] top-8 bottom-0 w-[2px] bg-slate-100 dark:bg-slate-800" />}
                           <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center ring-4 ring-white dark:ring-slate-950 z-10 text-brand-500 border border-brand-100 dark:border-brand-900/30">
                             <Clock size={12} />
                           </div>
                           <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 group hover:border-brand-500/30 transition-all">
                             <div className="flex items-center justify-between mb-3">
                               <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{new Date(h.booking_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                               <span className={cn(
                                 "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ring-1",
                                 h.status === 'Completed' ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-amber-50 text-amber-600 ring-amber-100"
                               )}>{h.status}</span>
                             </div>
                             <div className="flex items-center gap-4">
                               <div className="flex-1">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Consulting Doctor</p>
                                 <p className="text-sm font-bold dark:text-slate-200">{getDoctorName(h.doctor_id)}</p>
                               </div>
                               <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-brand-500 transition-colors shadow-sm">
                                 <FileText size={18} />
                               </div>
                             </div>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                </div>
              </div>

              {/* Panel Footer */}
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-900/30">
                <button 
                  onClick={handleSendWhatsApp}
                  className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-white font-black text-xs uppercase tracking-widest rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all active:scale-95 shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-slate-500/50"
                >
                  Send WhatsApp
                </button>
                <button 
                  onClick={() => setIsFollowUpOpen(true)}
                  className="flex-1 py-4 bg-brand-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50"
                >
                  Book Follow-up
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <FollowUpModal
        isOpen={isFollowUpOpen}
        onClose={() => setIsFollowUpOpen(false)}
        patientName={selectedPatient?.name || ''}
        patientPhone={selectedPatient?.phone || ''}
        onSubmit={async (days) => {
          if (!selectedPatient) return;
          
          const phone = selectedPatient.phone;
          const name = selectedPatient.name;

          const start = new Date();
          start.setDate(start.getDate() + days);
          const dateStr = start.toISOString().split('T')[0];
          
          const lastDoctorId = history.length > 0 ? history[0].doctor_id : '';
          const doctorName = getDoctorName(lastDoctorId);

          try {
            await addReminder({
              patient_name: name,
              patient_phone: phone,
              type: 'follow_up',
              item_name: `General Follow-up (${days} days)`,
              frequency: 'Once',
              duration_days: 1,
              start_date: dateStr,
              end_date: dateStr,
              times: ['08:00'],
              metadata: {
                doctor_name: doctorName
              }
            });
            alert('✅ Follow-up scheduled successfully.');
            setIsFollowUpOpen(false);
          } catch (err) {
            console.error('Failed to schedule follow-up:', err);
            alert('❌ Failed to schedule follow-up. Please try again.');
          }
        }}
      />
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    purple: "bg-purple-500/10 text-purple-600",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:scale-[1.02] transition-all duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className={cn("p-4 rounded-2xl", colors[color])}>
          {icon}
        </div>
        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight size={16} className="text-slate-400" />
        </div>
      </div>
      <div>
        <p className="text-4xl font-black dark:text-white tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <div className="w-1 h-1 rounded-full bg-slate-300" />
          <p className="text-[10px] font-bold text-slate-500">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ date }: { date: string | undefined }) {
  if (!date) return <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-black rounded-full uppercase">Unknown</span>;
  
  const lastVisit = new Date(date);
  const diffDays = Math.ceil((new Date().getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return (
      <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full w-fit">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
      </div>
    );
  } else if (diffDays <= 90) {
    return (
      <div className="flex items-center gap-2 text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full w-fit">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-widest">Regular</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-2 text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full w-fit">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <span className="text-[10px] font-black uppercase tracking-widest">Dormant</span>
      </div>
    );
  }
}

function InfoItem({ label, value, icon }: any) {
  return (
    <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 text-slate-400 mb-1.5">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-black dark:text-slate-200">{value}</p>
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
