import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Bell, 
  BarChart3, 
  Settings, 
  Search, 
  MessageSquare, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle,
  Clock, 
  FastForward,
  Activity,
  Stethoscope,
  LogOut,
  Loader2,
  Menu,
  X,
  Tv
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { ThemeToggle } from '../components/ThemeToggle';
import { useQueue } from '../hooks/useQueue';
import { useDoctors } from '../hooks/useDoctors';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';
import { useAuth } from '../components/AuthContext';
import { WalkInModal } from '../components/WalkInModal';
import { DoctorSelectModal } from '../components/DoctorSelectModal';
import { RemindersView } from '../components/RemindersView';
import { FollowUpModal } from '../components/FollowUpModal';
import { useReminders } from '../hooks/useReminders';
import { DoctorAvailabilityManager } from '../components/DoctorAvailabilityManager';
import { PatientsView } from '../components/PatientsView';
import { AppointmentsView } from '../components/AppointmentsView';
import { AnalyticsView } from '../components/AnalyticsView';
import { ClinicSettings } from '../components/ClinicSettingsView';
import { SetupClinic } from '../components/SetupClinic';
import { SuperAdminView } from '../components/SuperAdminView';
import { supabase } from '../lib/supabase';


type DashboardView = 'queue' | 'appointments' | 'patients' | 'reminders' | 'analytics' | 'settings' | 'doctor_availability';

export default function Dashboard() {
  const { queue, loading, markCompleted, callNext, prioritize, addWalkIn } = useQueue();
  const { addReminder } = useReminders();
  const { doctors } = useDoctors();
  const whatsappStatus = useWhatsAppStatus();
  const { user, profile, signOut } = useAuth();
  
  const [activeView, setActiveView] = useState<DashboardView>('queue');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [followUpPatient, setFollowUpPatient] = useState<any>(null);
  const [isDoctorSelectOpen, setIsDoctorSelectOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [branding, setBranding] = useState<any>(null);
  const [isTvModeOpen, setIsTvModeOpen] = useState(false);

  React.useEffect(() => {
    const loadBranding = async () => {
      if (!profile?.clinic_id) return;
      try {
        const { data } = await supabase
          .from('clinics')
          .select('branding_json, tier')
          .eq('id', profile.clinic_id)
          .maybeSingle();
        if (data?.tier === 'Professional' && data?.branding_json) {
          setBranding(data.branding_json);
        } else {
          setBranding(null);
        }
      } catch (err) {
        console.error('Error loading branding:', err);
      }
    };
    loadBranding();
  }, [profile?.clinic_id]);

  React.useEffect(() => {
    if (branding?.primary_color) {
      const hexToRgbStr = (hex: string) => {
        let c = hex.substring(1);
        if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        return `${r} ${g} ${b}`;
      };
      
      try {
        const rgbStr = hexToRgbStr(branding.primary_color);
        document.documentElement.style.setProperty('--brand-500', rgbStr);
      } catch (e) {
        console.error('Failed to parse primary color:', e);
      }
    } else {
      document.documentElement.style.setProperty('--brand-500', '14 165 233');
    }
  }, [branding]);

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="p-8 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3 mb-10 group cursor-pointer">
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 group-hover:scale-110 transition-transform duration-300">
                <Stethoscope size={22} strokeWidth={2.5} />
              </div>
            )}
            <span className="text-2xl font-black tracking-tight dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
              {branding?.logo_url ? profile?.full_name || 'Clinic' : 'ClinicPRO'}
            </span>
          </div>
          <button 
            className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            onClick={() => setIsMobileSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="space-y-1.5">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Queue Management" 
            active={activeView === 'queue'} 
            onClick={() => { setActiveView('queue'); setIsMobileSidebarOpen(false); }}
          />
          <NavItem 
            icon={<Calendar size={20} />} 
            label="Appointments" 
            active={activeView === 'appointments'} 
            onClick={() => { setActiveView('appointments'); setIsMobileSidebarOpen(false); }}
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="Patients & History" 
            active={activeView === 'patients'} 
            onClick={() => { setActiveView('patients'); setIsMobileSidebarOpen(false); }}
          />
          <NavItem 
            icon={<Bell size={20} />} 
            label="Reminders" 
            active={activeView === 'reminders'} 
            onClick={() => { setActiveView('reminders'); setIsMobileSidebarOpen(false); }}
          />
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="Analytics" 
            active={activeView === 'analytics'} 
            onClick={() => { setActiveView('analytics'); setIsMobileSidebarOpen(false); }}
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={activeView === 'settings'} 
            onClick={() => { setActiveView('settings'); setIsMobileSidebarOpen(false); }}
          />
        </nav>
      </div>
      
      <div className="p-6 space-y-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="p-5 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm relative overflow-hidden group text-center">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Authenticated as</p>
           <p className="text-xs font-bold dark:text-white truncate mb-4">{user?.email}</p>
           <button 
             onClick={handleSignOut}
             className="w-full py-2.5 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all flex items-center justify-center gap-2"
           >
             <LogOut size={14} /> Sign Out
           </button>
        </div>
      </div>
    </div>
  );

  const handleNextPatientClick = () => {
    if (doctors.length === 1) {
      callNext(doctors[0].id);
    } else if (doctors.length > 1) {
      setIsDoctorSelectOpen(true);
    } else {
      callNext();
    }
  };

  // Helper to format Visit ID (Prefix-000)
  const getFormattedToken = (doctorId: string, tokenNum: number | string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    const doctorName = doctor ? doctor.name : 'Unknown';
    const cleanName = doctorName.replace(/^Dr\.?\s+/i, '').trim();
    const parts = cleanName.split(' ');
    const prefix = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : cleanName.substring(0, 2).toUpperCase();
    const num = typeof tokenNum === 'number' ? tokenNum : parseInt(tokenNum, 10) || 0;
    return `${prefix}-${num.toString().padStart(3, '0')}`;
  };

  const getMaxCalledTokenForDoc = (docId: string) => {
    const calledPatients = queue.filter(p => 
      p.doctor_id === docId && 
      (p.status === 'serving' || p.status === 'completed')
    );
    if (calledPatients.length === 0) return 0;
    return Math.max(...calledPatients.map(p => Number(p.token) || 0));
  };

  const isPatientSkipped = (p: any) => {
    if (p.status === 'serving' || p.status === 'completed' || p.status === 'cancelled') return false;
    const maxCalled = getMaxCalledTokenForDoc(p.doctor_id);
    return (Number(p.token) || 0) <= maxCalled;
  };

  const emergencyQueue = queue.filter(p => p.status === 'emergency' && !isPatientSkipped(p));
  const waitingQueue = queue.filter(p => (p.status === 'waiting' || p.status === 'emergency' || p.status === 'serving') && !isPatientSkipped(p));
  const activeUpcomingQueue = queue.filter(p => (p.status === 'serving' || p.status === 'waiting') && !isPatientSkipped(p));
  const servingPatient = queue.find(p => p.status === 'serving');
  const servingToken = servingPatient ? servingPatient.token : '---';

  const activeWaiting = queue.filter(p => (p.status === 'waiting' || p.status === 'emergency') && !isPatientSkipped(p));
  const avgWaitTime = activeWaiting.length > 0 
    ? Math.round(activeWaiting.reduce((acc, p) => acc + (p.wait_time_mins || 0), 0) / activeWaiting.length)
    : 0;

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await signOut();
    }
  };

  if (user && !profile) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex flex-col items-center justify-center gap-4 transition-colors duration-500">
        <Loader2 className="animate-spin text-brand-500" size={48} />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading profile...</p>
      </div>
    );
  }

  const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'admin@clinicpro.com';
  const isSuperAdmin = profile?.role === 'admin' && user?.email === superAdminEmail;
  if (isSuperAdmin) {
    return <SuperAdminView />;
  }

  const renderTvQueueBoard = () => {
    // Current time clock
    const [currentTime, setCurrentTime] = React.useState(new Date());
    React.useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);

    const servingPatient = queue.find(p => p.status === 'serving');
    const nextPatients = queue.filter(p => p.status === 'waiting' || p.status === 'emergency').slice(0, 4);

    const servingDoctor = doctors.find(d => d.id === servingPatient?.doctor_id);
    const docPhoto = (branding?.queue_board?.show_doctor_photo !== false) ? (servingDoctor?.availability_json?.photo_url || '') : '';
    const showAddress = branding?.queue_board?.show_address !== false;
    const showLogo = branding?.queue_board?.show_logo !== false;
    const showTime = branding?.queue_board?.show_time !== false;
    const marqueeText = branding?.marquee_text || '';

    return (
      <div className="fixed inset-0 z-50 bg-[#020617] text-white flex flex-col justify-between p-8 font-sans overflow-hidden select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 shrink-0">
          <div className="flex items-center gap-4">
            {showLogo && branding?.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-2xl bg-white p-1" />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Stethoscope size={36} strokeWidth={2.5} />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                {branding ? profile?.full_name || 'Clinic' : 'ClinicPRO Queue Display'}
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Live Waiting Room Queue Board</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {showTime && (
              <div className="text-right">
                <p className="text-3xl font-black font-mono tracking-wider">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                <p className="text-[10px] text-brand-400 font-black uppercase tracking-widest mt-0.5">{currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              </div>
            )}
            <button 
              onClick={() => setIsTvModeOpen(false)} 
              className="px-5 py-3 bg-slate-800 hover:bg-rose-600 rounded-xl transition-all font-black text-xs uppercase tracking-wider active:scale-95 border border-slate-700"
            >
              Exit TV View
            </button>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="flex-1 my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch overflow-hidden">
          {/* NOW SERVING Column */}
          <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-[3rem] p-10 flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-12 opacity-5">
              <Activity size={240} className="text-brand-500" />
            </div>
            
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em]">Now Serving Patient</span>
            </div>

            {servingPatient ? (
              <div className="space-y-6 my-auto">
                <h2 className="text-8xl font-black font-mono tracking-tight text-brand-400 animate-pulse">
                  {getFormattedToken(servingPatient.doctor_id, servingPatient.token)}
                </h2>
                <div className="space-y-1">
                  <p className="text-4xl font-black tracking-tight">{servingPatient.name}</p>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Token #{servingPatient.token}</p>
                </div>
                
                {servingDoctor && (
                  <div className="flex items-center gap-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-850/50 w-fit">
                    <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {docPhoto ? (
                        <img src={docPhoto} alt="Doctor avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Stethoscope size={24} className="text-slate-550" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-200">{servingDoctor.name}</p>
                      <p className="text-[10px] text-brand-400 font-black uppercase tracking-widest">{servingDoctor.specialty || 'General Practitioner'}</p>
                      {servingDoctor.availability_json?.registration_number && (
                        <p className="text-[8px] text-slate-500 mt-0.5">Reg: {servingDoctor.availability_json.registration_number}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="my-auto text-center py-12">
                <p className="text-5xl font-black text-slate-700">---</p>
                <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">Waiting for next patient</p>
              </div>
            )}
            
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Please approach the reception when your token is active.</div>
          </div>

          {/* NEXT IN LINE Column */}
          <div className="lg:col-span-5 bg-slate-900/20 border border-slate-800/50 rounded-[3rem] p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-400 mb-6">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.25em]">Next Patients (Queue)</span>
              </div>
              
              <div className="space-y-4">
                {nextPatients.length > 0 ? (
                  nextPatients.map((patient, idx) => (
                    <div key={patient.id} className="flex items-center justify-between p-5 bg-slate-900/80 rounded-2xl border border-slate-800/40 hover:scale-[1.01] transition-transform">
                      <div className="flex items-center gap-4">
                        <span className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-slate-300">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-200">{patient.name}</p>
                          <p className="text-[9px] text-slate-550 font-bold uppercase tracking-wider mt-0.5">Status: {patient.status}</p>
                        </div>
                      </div>
                      <span className="text-lg font-black font-mono text-slate-400">
                        {getFormattedToken(patient.doctor_id, patient.token)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-slate-600 font-bold text-sm">
                    No upcoming patients waiting in queue
                  </div>
                )}
              </div>
            </div>

            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Queue Status: Active</span>
              <span>Total Waiting: {queue.filter(p => p.status === 'waiting' || p.status === 'emergency').length}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-4">
          {showAddress && (branding?.clinic_address || profile?.address) && (
            <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              📍 {branding?.clinic_address || profile?.address}
            </p>
          )}
          
          <div className="bg-slate-900 text-brand-500 py-3.5 px-6 rounded-2xl overflow-hidden relative shadow-lg border border-slate-800/80">
            <div className="animate-marquee whitespace-nowrap font-black text-xs uppercase tracking-[0.2em]">
              📢 {marqueeText || 'Welcome to ClinicPRO Queue Management. Enjoy real-time updates of patient schedules and appointment times.'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isTvModeOpen) {
    return renderTvQueueBoard();
  }

  if (!loading && !profile?.clinic_id) {
    return <SetupClinic />;
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-500 overflow-hidden font-sans selection:bg-brand-500/30">
      {/* Mesh Gradient Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-500/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-emerald-500/5 blur-[100px] rounded-full" />
      </div>

      {/* Sidebar for Desktop */}
      <aside className="w-72 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-800/60 hidden lg:flex flex-col shrink-0 z-20">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
            />
            {/* Sidebar Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col lg:hidden"
            >
              {renderSidebarContent()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-4 md:px-10 z-10 shrink-0">
          {/* Left: Mobile hamburger menu toggle & Desktop Search bar */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <Menu size={20} />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded-lg shadow-sm" />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                  <Stethoscope size={18} strokeWidth={2.5} />
                </div>
              )}
              <span className="text-lg font-black tracking-tight dark:text-white truncate max-w-[120px]">
                {branding?.logo_url ? profile?.full_name || 'Clinic' : 'ClinicPRO'}
              </span>
            </div>
            
            <div className="relative w-[400px] group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search patients, tokens, or history..." 
                className="w-full pl-12 pr-6 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-[1.25rem] text-sm font-medium transition-all focus:ring-4 focus:ring-brand-500/5 dark:text-white outline-none"
              />
            </div>
          </div>

          {/* Right: WhatsApp status & user profile */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* WhatsApp Status */}
            <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs font-bold transition-all shadow-sm ring-1",
                whatsappStatus === 'Connected' && "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900/50",
                whatsappStatus === 'Connecting' && "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-900/50",
                whatsappStatus === 'Error' && "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-900/50",
                whatsappStatus === 'Disconnected' && "bg-slate-50 text-slate-500 ring-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800"
              )}
              title={`WhatsApp: ${whatsappStatus}`}
            >
              <div className={cn(
                "w-2 h-2 rounded-full ring-4",
                whatsappStatus === 'Connected' && "bg-emerald-500 ring-emerald-500/20 animate-pulse",
                whatsappStatus === 'Connecting' && "bg-amber-500 ring-amber-500/20 animate-ping",
                whatsappStatus === 'Error' && "bg-rose-500 ring-rose-500/20",
                whatsappStatus === 'Disconnected' && "bg-slate-400 ring-slate-400/20"
              )} />
              <span className="hidden sm:inline">WhatsApp: {whatsappStatus}</span>
            </div>

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <ThemeToggle />

            <div className="flex items-center gap-3 pl-2 group cursor-pointer">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold dark:text-white group-hover:text-brand-500 transition-colors">{profile?.full_name || 'Clinic Admin'}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{profile?.role || 'Administrator'}</p>
              </div>
              <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-[1rem] bg-gradient-to-br from-brand-500 to-brand-700 p-[2px] shadow-lg shadow-brand-500/20 group-hover:rotate-6 transition-transform">
                <img className="w-full h-full rounded-[0.55rem] md:rounded-[0.9rem] object-cover bg-white" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'Clinic Admin')}&background=fff&color=0ea5e9`} alt="Profile" />
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 custom-scrollbar">
          {/* Mobile Search Bar */}
          <div className="md:hidden relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search patients, tokens, or history..." 
              className="w-full pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-[1.25rem] text-sm font-medium transition-all focus:ring-4 focus:ring-brand-500/5 dark:text-white outline-none shadow-sm"
            />
          </div>

          {activeView === 'queue' && (
            <>
              {/* Top Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                <MetricCard 
                  label="Today's Appointments" 
                  value={queue.length.toString()} 
                  trend="+12% vs yesterday"
                  icon={<Calendar className="text-brand-500" size={24} />}
                />
                <MetricCard 
                  label="Currently Serving" 
                  value={servingToken !== '---' ? `#${servingToken}` : '---'} 
                  highlight 
                  icon={<Activity className="text-white" size={24} />}
                />
                <MetricCard 
                  label="Avg. Wait Time" 
                  value={`${avgWaitTime} min`} 
                  trend="Updated live"
                  icon={<Clock className="text-brand-500" size={24} />}
                />
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center gap-4 group hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all duration-300">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinic Controls</p>
                   <div className="flex flex-col gap-3">
                     <ActionButton onClick={() => setIsModalOpen(true)} icon={<UserPlus size={18} />} label="Add Walk-in" primary />
                     <ActionButton onClick={handleNextPatientClick} icon={<FastForward size={18} />} label="Next Patient" />
                     <ActionButton onClick={() => setIsTvModeOpen(true)} icon={<Tv size={18} />} label="Launch TV Display" />
                   </div>
                </div>
              </div>

              <div className="w-full space-y-8">
                {/* Live Queue Board */}
                <div className="space-y-8">
                  {/* Emergency Queue */}
                  <AnimatePresence>
                    {emergencyQueue.length > 0 && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0, y: -20 }}
                        animate={{ height: 'auto', opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: -20 }}
                        className="bg-rose-50/50 dark:bg-rose-950/20 border-2 border-rose-100 dark:border-rose-900/30 rounded-[2.5rem] p-8 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                          <AlertCircle size={120} className="text-rose-500" />
                        </div>
                        <div className="flex items-center justify-between mb-6 relative">
                          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                            <div className="p-2 bg-rose-500 text-white rounded-lg animate-pulse shadow-lg shadow-rose-500/20">
                              <AlertCircle size={20} />
                            </div>
                            <h3 className="font-black uppercase tracking-widest text-sm">Emergency Priority Queue</h3>
                          </div>
                          <span className="text-[10px] font-black bg-rose-500 text-white px-3 py-1 rounded-full shadow-lg shadow-rose-500/20">U R G E N T</span>
                        </div>
                        <div className="space-y-4 relative">
                          {emergencyQueue.map(patient => (
                            <motion.div 
                              key={patient.id} 
                              layout
                              className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md border border-rose-100/50 dark:border-rose-900/20 group hover:scale-[1.01] transition-transform"
                            >
                              <div className="flex items-center gap-5">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">#{patient.token}</span>
                                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500">({getFormattedToken(patient.doctor_id, patient.token)})</span>
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800 dark:text-white">{patient.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Critical Priority</p>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => markCompleted(patient.id)}
                                className="px-5 py-2.5 bg-rose-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95"
                              >
                                Admit Now
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Waiting List */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/30 dark:shadow-none overflow-hidden group/list">
                    <div className="p-6 md:p-10 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30">
                      <div>
                        <h3 className="font-black text-xl text-slate-800 dark:text-white tracking-tight">Upcoming Queue</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">Real-time patient flow monitoring</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="px-4 py-2 bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-brand-500/20">{waitingQueue.length} Active</span>
                      </div>
                    </div>
                    <div className="p-4 overflow-x-auto text-center">
                      {loading ? (
                         <div className="p-20 flex flex-col items-center gap-3"><Loader2 className="animate-spin text-brand-500" size={32} /><p className="text-sm font-bold text-slate-400">Syncing with server...</p></div>
                      ) : activeUpcomingQueue.length === 0 ? (
                        <div className="p-20 flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-700">
                            <Users size={32} />
                          </div>
                          <p className="text-sm font-bold text-slate-400">No patients in the queue for today.</p>
                          <button onClick={() => setIsModalOpen(true)} className="text-xs font-black text-brand-500 hover:underline">Add first walk-in patient</button>
                        </div>
                      ) : (
                      <table className="w-full border-separate border-spacing-y-3 min-w-[600px]">
                        <thead>
                          <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            <th className="px-6 py-4">Token ID</th>
                            <th className="px-6 py-4">Patient Profile</th>
                            <th className="px-6 py-4">Entry Point</th>
                            <th className="px-6 py-4 text-center">Wait</th>
                            <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence initial={false}>
                            {activeUpcomingQueue.map((patient) => (
                              <motion.tr 
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={patient.id} 
                                className={cn(
                                  "group transition-all duration-300 text-left",
                                  patient.status === 'serving' ? "bg-brand-50/50 dark:bg-brand-900/10 shadow-lg shadow-brand-500/5 ring-2 ring-brand-500/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                )}
                              >
                                <td className="px-6 py-6 first:rounded-l-2xl last:rounded-r-2xl">
                                  <div className="flex items-center gap-4">
                                    <span className={cn(
                                      "w-10 h-10 flex items-center justify-center rounded-xl font-black text-sm shrink-0",
                                      patient.status === 'serving' ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                    )}>#{patient.token}</span>
                                    <div>
                                      <p className="text-xs font-black text-slate-700 dark:text-slate-200">{getFormattedToken(patient.doctor_id, patient.token)}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Visit ID</p>
                                    </div>
                                    {patient.status === 'serving' && <motion.span initial={{scale: 0}} animate={{scale:1}} className="text-[10px] font-black text-brand-600 bg-brand-100 dark:bg-brand-900/30 px-2 py-0.5 rounded-full ring-1 ring-brand-200/50">LIVE</motion.span>}
                                  </div>
                                </td>
                                <td className="px-6 py-6">
                                  <p className="font-bold text-sm text-slate-800 dark:text-white">{patient.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Regular Visit</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <p className="text-[10px] text-brand-500 font-black uppercase tracking-widest">{patient.booking_time}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-6">
                                  <div className={cn(
                                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ring-1",
                                    patient.source === 'whatsapp' ? "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/50" : "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:ring-blue-900/30"
                                  )}>
                                    {patient.source === 'whatsapp' ? <MessageSquare size={14} fill="currentColor" /> : <Users size={14} fill="currentColor" />}
                                    {patient.source}
                                  </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                  <p className="text-xs font-black text-slate-600 dark:text-slate-300">{patient.wait_time_mins}m</p>
                                </td>
                                <td className="px-6 py-6 text-right first:rounded-l-2xl last:rounded-r-2xl">
                                  <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => setFollowUpPatient(patient)} 
                                      className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-90" 
                                      title="Set Follow-up"
                                    >
                                      <Calendar size={18} />
                                    </button>
                                    <button onClick={() => markCompleted(patient.id)} className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-90" title="Complete"><CheckCircle2 size={18} /></button>
                                    <button onClick={() => prioritize(patient.id)} className="p-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-90" title="Emergency"><AlertCircle size={18} /></button>
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {branding?.marquee_text && (
                <div className="bg-slate-900 dark:bg-slate-950 text-brand-500 py-4 px-6 rounded-3xl overflow-hidden relative shadow-lg border border-slate-800/80">
                  <div className="animate-marquee whitespace-nowrap font-black text-xs uppercase tracking-[0.2em]">
                    📢 {branding.marquee_text}
                  </div>
                </div>
              )}
            </>
          )}

          {activeView === 'appointments' && <AppointmentsView />}
          {activeView === 'patients' && <PatientsView />}
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'settings' && <ClinicSettings onManageAvailability={() => setActiveView('doctor_availability')} />}
          {activeView === 'doctor_availability' && <DoctorAvailabilityManager />}

          {activeView === 'reminders' && <RemindersView />}
        </div>
      </main>

      <WalkInModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        doctors={doctors}
        onSubmit={async (name, phone, age, doctorId, time, patientId) => {
          await addWalkIn(name, phone, age, doctorId, time, patientId);
        }}
      />

      <FollowUpModal
        isOpen={!!followUpPatient}
        onClose={() => setFollowUpPatient(null)}
        patientName={followUpPatient?.name || ''}
        patientPhone={followUpPatient?.phone || ''}
        onSubmit={async (days) => {
          if (!followUpPatient) return;
          
          const phone = followUpPatient.phone || 'walk-in';
          const name = followUpPatient.name || 'Unknown Patient';

          const start = new Date();
          start.setDate(start.getDate() + days);
          const dateStr = start.toISOString().split('T')[0];
          
          const doctorName = doctors.find((d: any) => d.id === followUpPatient.doctor_id)?.name || '';

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
            alert('Follow-up scheduled successfully.');
          } catch (err) {
            console.error('Failed to schedule follow-up:', err);
            alert('Failed to schedule follow-up. Please ensure patient details are complete.');
          }
        }}
      />

      <DoctorSelectModal
        isOpen={isDoctorSelectOpen}
        onClose={() => setIsDoctorSelectOpen(false)}
        doctors={doctors}
        onSelect={async (doctorId) => {
          await callNext(doctorId);
        }}
      />
    </div>
  );
}


function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-6 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden text-left",
        active 
          ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25" 
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
      )}
    >
      <span className={cn("transition-transform duration-300 group-hover:scale-110", active ? "text-white" : "text-slate-400 group-hover:text-brand-500")}>{icon}</span>
      <span className={cn("text-sm font-bold tracking-tight", active ? "text-white" : "text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white")}>{label}</span>
      {active && (
        <motion.div 
          layoutId="active-nav-bg"
          className="absolute inset-0 bg-gradient-to-r from-brand-600 to-brand-500 -z-10"
        />
      )}
    </button>
  );
}

function MetricCard({ label, value, trend, highlight = false, icon }: { label: string, value: string, trend?: string, highlight?: boolean, icon: React.ReactNode }) {
  return (
    <div className={cn(
      "p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border shadow-xl transition-all duration-500 relative overflow-hidden group hover:-translate-y-2",
      highlight 
        ? "bg-gradient-to-br from-brand-600 to-brand-700 border-brand-500 text-white shadow-brand-500/20" 
        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-slate-200/50 dark:shadow-none"
    )}>
      <div className="flex justify-between items-start mb-6 relative z-10">
        <p className={cn("text-[10px] font-black uppercase tracking-[0.2em]", highlight ? "text-brand-100/80" : "text-slate-400")}>{label}</p>
        <div className={cn(
          "w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all duration-500", 
          highlight ? "bg-white/10 group-hover:bg-white/20 group-hover:rotate-12" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/20 group-hover:rotate-12"
        )}>
          {icon}
        </div>
      </div>
      <p className="text-4xl font-black tracking-tight mb-2 relative z-10 dark:text-white">{value}</p>
      {trend && (
        <div className="flex items-center gap-1.5 relative z-10">
          <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider", highlight ? "bg-white/10 text-brand-100" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400")}>
            {trend}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ onClick, icon, label, primary = false }: { onClick: () => void, icon: React.ReactNode, label: string, primary?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 relative overflow-hidden group active:scale-95",
        primary 
          ? "bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/25" 
          : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
      )}
    >
      <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">{icon}</span>
      {label}
      {primary && <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />}
    </button>
  );
}
