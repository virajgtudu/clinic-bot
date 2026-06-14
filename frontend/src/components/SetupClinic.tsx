import React, { useState } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export function SetupClinic() {
  const { profile, signOut } = useAuth();
  const [phoneId, setPhoneId] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneId || !clinicName) return;

    setIsSubmitting(true);
    try {
      // 1. Create or update clinic record
      const { error: clinicError } = await supabase
        .from('clinics')
        .upsert({ id: phoneId, name: clinicName }, { onConflict: 'id' });

      if (clinicError) {
        console.error('Clinic upsert error:', clinicError);
        throw clinicError;
      }

      // 2. Link profile to clinic
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ clinic_id: phoneId, full_name: clinicName })
        .eq('id', profile?.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }

      window.location.reload();
    } catch (err: any) {
      console.error('Setup failed:', err);
      alert(`Setup failed: ${err.message || 'Please try again later.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-brand-500/20">
            <Settings size={32} aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-black dark:text-white">Setup Your Clinic</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">Link your account to your Meta Phone Number ID to start managing your queue.</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-6">
          <div>
            <label htmlFor="setupClinicName" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 cursor-pointer">Clinic Name</label>
            <input 
              id="setupClinicName"
              name="clinicName"
              type="text" 
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="e.g. City Care Clinic…"
              className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
              required
              autoComplete="organization"
              spellCheck={false}
            />
          </div>
          <div>
            <label htmlFor="setupPhoneId" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 cursor-pointer">Meta Phone Number ID</label>
            <input 
              id="setupPhoneId"
              name="phoneId"
              type="text" 
              value={phoneId}
              onChange={(e) => setPhoneId(e.target.value)}
              placeholder="Enter your 15-digit ID…"
              className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
              required
            />
            <p className="text-[10px] text-slate-400 font-bold mt-2 ml-1">Find this in your Meta Business Suite dashboard.</p>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-4 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : 'Complete Setup'}
          </button>
        </form>
        
        <button onClick={signOut} className="w-full mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded py-1">
          Sign out and try later
        </button>
      </div>
    </div>
  );
}
