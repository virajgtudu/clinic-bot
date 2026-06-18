import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  ChevronRight, 
  UserPlus, 
  Settings, 
  AlertCircle, 
  Stethoscope, 
  Loader2, 
  ShieldCheck,
  Palette
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from './AuthContext';
import { useDoctors } from '../hooks/useDoctors';
import type { Doctor } from '../hooks/useDoctors';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export function ClinicSettings({ onManageAvailability }: { onManageAvailability: () => void }) {
  const { profile } = useAuth();
  const [clinicName, setClinicName] = useState(profile?.full_name || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9');
  const [signature, setSignature] = useState('');
  const [marqueeText, setMarqueeText] = useState('');
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [tier, setTier] = useState('Essential');
  const [isUpgrading, setIsUpgrading] = useState(false);

  React.useEffect(() => {
    const fetchBranding = async () => {
      if (!profile?.clinic_id) return;
      try {
        const { data, error } = await supabase
          .from('clinics')
          .select('branding_json, tier')
          .eq('id', profile.clinic_id)
          .maybeSingle();

        if (data && !error) {
          setTier(data.tier || 'Essential');
          if (data.branding_json) {
            const b = data.branding_json;
            setLogoUrl(b.logo_url || '');
            setPrimaryColor(b.primary_color || '#0ea5e9');
            setSignature(b.signature || '');
            setMarqueeText(b.marquee_text || '');
          }
        }
      } catch (err) {
        console.error('Failed to load branding:', err);
      }
    };
    fetchBranding();
  }, [profile?.clinic_id]);

  const handleUpgrade = async () => {
    if (!profile?.clinic_id) return;
    setIsUpgrading(true);
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ tier: 'Professional' })
        .eq('id', profile.clinic_id);

      if (error) throw error;
      setTier('Professional');
      alert('🎉 Congratulations! You have successfully upgraded to the Professional Package! Custom Branding features are now unlocked.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to upgrade. Please ensure the database has been migrated with the tier column.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.clinic_id) return;
    setIsSavingBranding(true);
    try {
      const branding = {
        logo_url: logoUrl,
        primary_color: primaryColor,
        signature,
        marquee_text: marqueeText
      };
      const { error } = await supabase
        .from('clinics')
        .update({ branding_json: branding })
        .eq('id', profile.clinic_id);

      if (error) throw error;
      alert('Branding updated successfully! Refreshing page to apply changes...');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to update branding settings. Please verify database columns.');
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleUpdateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName || !profile?.clinic_id) return;
    setIsUpdating(true);
    try {
      await supabase.from('clinics').update({ name: clinicName }).eq('id', profile.clinic_id);
      await supabase.from('profiles').update({ full_name: clinicName }).eq('id', profile.id);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to update clinic name');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl">
          <h2 className="text-2xl font-black dark:text-white mb-2 tracking-tight">Clinic Profile</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8">Identity & Branding</p>
          
          <form onSubmit={handleUpdateClinic} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="clinicDisplayName" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Clinic Display Name</label>
              <input 
                id="clinicDisplayName"
                name="clinicDisplayName"
                type="text" 
                value={clinicName} 
                onChange={e => setClinicName(e.target.value)} 
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                autoComplete="organization"
                spellCheck={false}
              />
            </div>
            <button 
              type="submit" 
              disabled={isUpdating}
              className="w-full py-4 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50"
            >
              {isUpdating ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : 'Update Identity'}
            </button>
          </form>
        </div>

        {/* Availability Entry Point */}
        <button 
          onClick={onManageAvailability}
          className="bg-gradient-to-br from-brand-600 to-brand-700 p-10 rounded-[3rem] text-white shadow-xl shadow-brand-500/20 text-left relative overflow-hidden group hover:scale-[1.02] transition-all outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50"
        >
          <Calendar className="absolute -right-10 -bottom-10 w-48 h-48 text-white/10 group-hover:rotate-12 transition-transform duration-700" aria-hidden="true" />
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-8">
            <Clock size={32} aria-hidden="true" />
          </div>
          <h3 className="text-2xl font-black tracking-tight mb-2 uppercase">Doctor Availability</h3>
          <p className="text-brand-100 text-xs font-medium max-w-[200px] leading-relaxed mb-6">Manage weekly sessions, off-days, and consultation timings.</p>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-brand-600 rounded-xl font-black text-[10px] uppercase tracking-widest">
            Configure Now <ChevronRight size={14} aria-hidden="true" />
          </div>
        </button>
      </div>

      {/* Custom Branding Card */}
      <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
        {tier !== 'Professional' && (
          <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/60 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-indigo-500 rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl shadow-brand-500/25">
              <Palette size={28} />
            </div>
            <span className="px-4 py-1.5 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[10px] font-black rounded-full border border-brand-100 dark:border-brand-900/50 uppercase tracking-widest mb-3">
              Professional Package Exclusive
            </span>
            <h3 className="text-3xl font-black dark:text-white tracking-tight max-w-md leading-tight">
              Unlock Custom Branding & White-Labeling
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-sm mt-3 leading-relaxed">
              Design a cohesive experience for your patients. Upload your clinic logo, pick custom theme colors, customize WhatsApp footers, and show live marquee messages.
            </p>
            <button 
              type="button"
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className="mt-8 px-10 py-4 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/25 active:scale-95 flex items-center gap-2 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50"
            >
              {isUpgrading ? <Loader2 className="animate-spin" size={18} /> : 'Upgrade to Professional'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Palette size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black dark:text-white tracking-tight">Custom Branding</h2>
                {tier === 'Professional' && (
                  <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-full border border-emerald-200 dark:border-emerald-900/30 uppercase tracking-wider">
                    Professional Plan
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">White-label Patient Touchpoints</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveBranding} className="mt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="logoUrl" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Clinic Logo URL</label>
              <input 
                id="logoUrl"
                name="logoUrl"
                type="url" 
                value={logoUrl} 
                onChange={e => setLogoUrl(e.target.value)} 
                placeholder="https://example.com/logo.png"
                disabled={tier !== 'Professional'}
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
              />
              {logoUrl && (
                <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center gap-3 w-fit border border-slate-100 dark:border-slate-800">
                  <span className="text-[9px] font-black uppercase text-slate-400">Logo Preview:</span>
                  <img src={logoUrl} alt="Logo Preview" className="h-8 max-w-[150px] object-contain rounded-md" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="primaryColor" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Primary Theme Color</label>
              <div className="flex gap-4 items-center">
                <input 
                  id="primaryColorPicker"
                  type="color" 
                  value={primaryColor} 
                  onChange={e => setPrimaryColor(e.target.value)} 
                  disabled={tier !== 'Professional'}
                  className="w-16 h-14 bg-transparent border-0 rounded-2xl cursor-pointer p-0 shrink-0"
                />
                <input 
                  id="primaryColor"
                  name="primaryColor"
                  type="text" 
                  value={primaryColor} 
                  onChange={e => setPrimaryColor(e.target.value)} 
                  placeholder="#0ea5e9"
                  disabled={tier !== 'Professional'}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white uppercase"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="whatsappSignature" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">WhatsApp Message Signature</label>
              <input 
                id="whatsappSignature"
                name="whatsappSignature"
                type="text" 
                value={signature} 
                onChange={e => setSignature(e.target.value)} 
                placeholder="e.g. Regards, Apollo Health Clinic"
                disabled={tier !== 'Professional'}
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
              />
              <p className="text-[9px] text-slate-400 ml-1 font-bold uppercase tracking-wider">Automatically appended as a footer to all outgoing patient reminder messages.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="marqueeText" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Waiting Room TV Marquee Announcement</label>
              <input 
                id="marqueeText"
                name="marqueeText"
                type="text" 
                value={marqueeText} 
                onChange={e => setMarqueeText(e.target.value)} 
                placeholder="e.g. HEALTH UPDATE: DEAR PATIENTS, WE NOW OFFER FREE DENTAL CHECK-UPS EVERY SUNDAY!"
                disabled={tier !== 'Professional'}
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
              />
              <p className="text-[9px] text-slate-400 ml-1 font-bold uppercase tracking-wider">A horizontal scrolling announcement bar displayed at the bottom of the live queue board screen.</p>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSavingBranding || tier !== 'Professional'}
            className="w-full md:w-auto px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50"
          >
            {isSavingBranding ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : 'Save Branding Configurations'}
          </button>
        </form>
      </div>

      <DoctorSettings />
    </div>
  );
}

function DoctorSettings() {
  const { doctors, loading, addDoctor, updateDoctor, deleteDoctor } = useDoctors();
  const [isAdding, setIsAdding] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experience, setExperience] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = { 
      name, 
      specialty, 
      qualifications, 
      experience 
    };

    if (editingDoctor) {
      await updateDoctor(editingDoctor.id, payload);
      setEditingDoctor(null);
    } else {
      // Default dynamic availability if creating new
      const defaultAvailability = {
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
      await addDoctor({ ...payload, availability_json: defaultAvailability });
      setIsAdding(false);
    }
    setName('');
    setSpecialty('');
    setQualifications('');
    setExperience('');
  };

  const startEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setName(doc.name);
    setSpecialty(doc.specialty || '');
    setQualifications(doc.qualifications || '');
    setExperience(doc.experience || '');
    setIsAdding(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight">Doctor Management</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Configure your clinic’s medical staff profiles</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => { setIsAdding(true); setEditingDoctor(null); setName(''); setSpecialty(''); setQualifications(''); setExperience(''); }}
            className="px-6 py-3 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 flex items-center gap-2 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50"
          >
            <UserPlus size={18} aria-hidden="true" /> Add New Doctor
          </button>
        )}
      </div>

      {isAdding && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label htmlFor="docName" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Doctor Full Name</label>
                <input 
                  id="docName"
                  name="name"
                  type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="e.g. Dr. Prabhat Jain"
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20"
                  autoComplete="name"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="docSpecialty" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Specialty / Primary Focus</label>
                <input 
                  id="docSpecialty"
                  name="specialty"
                  type="text" value={specialty} onChange={e => setSpecialty(e.target.value)}
                  placeholder="e.g. Cardiologist, Orthopedic Surgeon"
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label htmlFor="docQualifications" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Qualifications & Degrees</label>
                <textarea 
                  id="docQualifications"
                  name="qualifications"
                  rows={2} value={qualifications} onChange={e => setQualifications(e.target.value)}
                  placeholder="e.g. MBBS, MD (Medicine), DM (Cardiology)"
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="docExperience" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Years of Experience / Bio</label>
                <textarea 
                  id="docExperience"
                  name="experience"
                  rows={2} value={experience} onChange={e => setExperience(e.target.value)}
                  placeholder="e.g. 15+ years of clinical experience in tertiary care hospitals."
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="bg-brand-50/50 dark:bg-brand-900/10 p-6 rounded-3xl border border-brand-100/50 dark:border-brand-900/30">
               <div className="flex items-center gap-3 text-brand-600 dark:text-brand-400 mb-2">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Dynamic Scheduling Enabled</span>
               </div>
               <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Session timings are now managed separately via the <span className="font-black text-brand-500">Doctor Availability</span> dashboard for better accuracy and WhatsApp booking support.</p>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="submit" className="flex-1 py-4 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50">
                {editingDoctor ? 'Update Profile' : 'Create Profile'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all outline-none focus-visible:ring-4 focus-visible:ring-slate-500/50">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin text-brand-500 mx-auto" size={32} aria-hidden="true" /></div>
        ) : doctors.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 p-20 rounded-[2.5rem] text-center border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-400 font-bold">No doctors added yet. Start by adding your first doctor.</p>
          </div>
        ) : (
          doctors.map(doc => (
            <div key={doc.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:shadow-xl transition-all duration-500">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-900/10 flex items-center justify-center text-brand-500">
                  <Stethoscope size={32} aria-hidden="true" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(doc)} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-brand-500 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500" title="Edit Profile"><Settings size={16} aria-hidden="true" /></button>
                  <button onClick={() => { if(confirm('Delete this doctor?')) deleteDoctor(doc.id); }} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rose-500" title="Remove Doctor"><AlertCircle size={16} aria-hidden="true" /></button>
                </div>
              </div>
              <h4 className="text-xl font-black dark:text-white">{doc.name}</h4>
              <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mt-1 mb-2">{doc.specialty || 'General Physician'}</p>
              
              {doc.qualifications && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed mb-4 line-clamp-2">
                  {doc.qualifications}
                </p>
              )}

              <div className="mt-4 pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" aria-hidden="true" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule Status</span>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  doc.availability_json?.version === "2.0" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                )}>
                  {doc.availability_json?.version === "2.0" ? 'Configured' : 'Legacy'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
