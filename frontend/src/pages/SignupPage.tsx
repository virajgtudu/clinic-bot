import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import { motion } from 'framer-motion';
import { Stethoscope, Mail, Lock, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            clinic_name: clinicName,
          }
        }
      });

      if (signupError) throw signupError;
      
      // In a real app, you'd also create the clinic record and profile here 
      // or via a database trigger on auth.users insert.
      // For this demo, we'll assume a trigger handles it or we do it manually if needed.
      
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex items-center justify-center p-6 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 group-hover:scale-110 transition-transform">
              <Stethoscope size={28} strokeWidth={2.5} />
            </div>
            <span className="text-3xl font-black tracking-tight dark:text-white">ClinicPRO</span>
          </Link>
          <h2 className="text-2xl font-black dark:text-white">Start your free trial</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">Join 500+ clinics using ClinicPRO today</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-black dark:text-white mb-2">Check your email</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">We've sent a verification link to your email address.</p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Clinic Name</label>
                <div className="relative">
                  <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="City Care Clinic"
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@clinic.com"
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Create Account <ArrowRight size={20} /></>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-8 text-sm font-bold text-slate-500 dark:text-slate-400">
          Already have an account? <Link to="/login" className="text-brand-500 hover:underline">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
}
