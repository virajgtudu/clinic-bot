import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Activity, 
  DollarSign, 
  Trash2, 
  Plus, 
  Loader2, 
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  ShieldAlert,
  Mail,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import { ThemeToggle } from './ThemeToggle';

interface Clinic {
  id: string;
  phone_number_id: string;
  name: string;
  phone?: string;
  address?: string;
  subscription_status?: string;
  monthly_fee?: number;
  tier?: string;
  created_date?: string;
  expiry_date?: string;
  emails?: string[];
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  trial: number;
  monthly_revenue: number;
}

export function SuperAdminView() {
  const { session, signOut } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states for provisioning a new clinic
  const [isAdding, setIsAdding] = useState(false);
  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicPhone, setNewClinicPhone] = useState('');
  const [newClinicAddress, setNewClinicAddress] = useState('');
  const [newClinicPhoneId, setNewClinicPhoneId] = useState('');
  const [newClinicEmail, setNewClinicEmail] = useState('');
  const [newClinicPassword, setNewClinicPassword] = useState('');
  const [newClinicFee, setNewClinicFee] = useState(1500);
  const [newClinicStatus, setNewClinicStatus] = useState('active');
  const [newClinicTier, setNewClinicTier] = useState('Essential');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchAdminData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };

      // 1. Fetch Stats
      const statsRes = await fetch(`${apiBaseUrl}/api/admin/stats`, { headers });
      if (!statsRes.ok) throw new Error('Failed to fetch platform statistics');
      const statsJson = await statsRes.json();

      // 2. Fetch Clinics
      const clinicsRes = await fetch(`${apiBaseUrl}/api/admin/clinics`, { headers });
      if (!clinicsRes.ok) throw new Error('Failed to fetch clinic directory');
      const clinicsJson = await clinicsRes.json();

      setStats(statsJson.stats);
      setClinics(clinicsJson.clinics);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading administration panels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [session?.access_token]);

  const handleUpdateStatus = async (phoneId: string, status: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/update-clinic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          phone_number_id: phoneId,
          updates: { subscription_status: status }
        })
      });
      if (!res.ok) throw new Error('Failed to update status');
      
      // Update local state
      setClinics(prev => prev.map(c => c.phone_number_id === phoneId ? { ...c, subscription_status: status } : c));
      
      // Re-calculate local stats
      if (stats) {
        setStats({
          ...stats,
          active: clinics.filter(c => c.phone_number_id === phoneId ? status === 'active' : c.subscription_status === 'active').length,
          inactive: clinics.filter(c => c.phone_number_id === phoneId ? status === 'inactive' : c.subscription_status === 'inactive').length,
          trial: clinics.filter(c => c.phone_number_id === phoneId ? status === 'trial' : c.subscription_status === 'trial').length,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update subscription status');
    }
  };

  const handleUpdateTier = async (phoneId: string, tier: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/update-clinic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          phone_number_id: phoneId,
          updates: { tier }
        })
      });
      if (!res.ok) throw new Error('Failed to update package tier');
      
      // Update local state
      setClinics(prev => prev.map(c => c.phone_number_id === phoneId ? { ...c, tier } : c));
      alert(`Successfully changed plan to ${tier} tier!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update package tier');
    }
  };

  const handleDeleteClinic = async (phoneId: string, name: string) => {
    if (!session?.access_token) return;
    if (!confirm(`Are you absolutely sure you want to completely delete "${name}"? This action is permanent and deletes all clinic records.`)) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/delete-clinic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ phone_number_id: phoneId })
      });
      if (!res.ok) throw new Error('Failed to delete clinic');
      
      // Refresh statistics & lists
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete clinic');
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!session?.access_token) return;
    const newPassword = prompt(`Enter new password for ${email} (minimum 6 characters):`);
    if (newPassword === null) return; // cancelled
    if (newPassword.trim().length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }
    
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email,
          new_password: newPassword.trim()
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reset password');
      alert(`Success: ${json.message}`);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleProvisionClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setIsSubmitting(true);
    setSuccessMsg(null);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/create-clinic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: newClinicName,
          phone: newClinicPhone,
          address: newClinicAddress,
          phone_number_id: newClinicPhoneId,
          subscription_status: newClinicStatus,
          monthly_fee: newClinicFee,
          tier: newClinicTier,
          email: newClinicEmail,
          password: newClinicPassword,
          doctors: []
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to provision new clinic account');

      setSuccessMsg(`🎉 Success! Clinic "${newClinicName}" has been successfully provisioned. Login credentials registered.`);
      
      // Reset form states
      setNewClinicName('');
      setNewClinicPhone('');
      setNewClinicAddress('');
      setNewClinicPhoneId('');
      setNewClinicEmail('');
      setNewClinicPassword('');
      setIsAdding(false);
      
      // Reload lists
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to provision clinic');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] flex flex-col items-center justify-center gap-4 transition-colors duration-500">
        <Loader2 className="animate-spin text-brand-500" size={48} />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Master Admin Panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] text-slate-900 dark:text-slate-50 transition-colors duration-500 pb-20">
      
      {/* Top Navigation Bar */}
      <nav className="border-b border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-[#020617]/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-500/20">
              <Building2 size={22} />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                ClinicPRO Admin
              </span>
              <span className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[8px] font-black rounded-full border border-red-200 dark:border-red-900/30 uppercase tracking-wider">
                Super User
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button 
              onClick={signOut}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-8 pt-12 space-y-12">
        
        {/* Title and Top Header bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black dark:text-white tracking-tight">System Control Panel</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage platform tenants, billing configurations, and subscription tiers</p>
          </div>
          
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-brand-500/25 flex items-center gap-2 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50 active:scale-95"
            >
              <Plus size={18} /> Provision New Clinic
            </button>
          )}
        </div>

        {/* Global Notifications */}
        <AnimatePresence>
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="p-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-3xl text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-3"
            >
              <CheckCircle2 size={20} />
              <span>{successMsg}</span>
            </motion.div>
          )}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="p-5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-3xl text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-3"
            >
              <ShieldAlert size={20} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Overview Metrics grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total tenants</p>
                <h3 className="text-4xl font-black dark:text-white">{stats.total}</h3>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl"><Building2 size={24} /></div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Clinics</p>
                <h3 className="text-4xl font-black text-emerald-500">{stats.active}</h3>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl"><Activity size={24} /></div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trial / Inactive</p>
                <h3 className="text-4xl font-black text-amber-500">{stats.trial + stats.inactive}</h3>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-2xl"><Users size={24} /></div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Monthly Revenue</p>
                <h3 className="text-4xl font-black text-indigo-500">₹{stats.monthly_revenue}</h3>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl"><DollarSign size={24} /></div>
            </div>
          </div>
        )}

        {/* Provisioning Form wizard modal view */}
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200/50 dark:border-slate-800 shadow-xl overflow-hidden"
            >
              <h3 className="text-2xl font-black mb-1 dark:text-white">Provision New Clinic Tenant</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Creates database records and Auth user login instantly</p>
              
              <form onSubmit={handleProvisionClinic} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinic Name</label>
                    <input 
                      type="text" value={newClinicName} onChange={e => setNewClinicName(e.target.value)} required
                      placeholder="e.g. Apollo Family Care Clinic"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Meta Phone Number ID</label>
                    <input 
                      type="text" value={newClinicPhoneId} onChange={e => setNewClinicPhoneId(e.target.value)} required
                      placeholder="15-digit Meta developer ID"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinic Contact Phone</label>
                    <input 
                      type="text" value={newClinicPhone} onChange={e => setNewClinicPhone(e.target.value)} required
                      placeholder="+91 98765 43210"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinic Physical Address</label>
                    <input 
                      type="text" value={newClinicAddress} onChange={e => setNewClinicAddress(e.target.value)}
                      placeholder="Street name, City, State"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    />
                  </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />
                
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">🔐 Setup Initial Login Credentials</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Administrator Email Address</label>
                    <input 
                      type="email" value={newClinicEmail} onChange={e => setNewClinicEmail(e.target.value)} required
                      placeholder="admin@newclinic.com"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Password</label>
                    <input 
                      type="password" value={newClinicPassword} onChange={e => setNewClinicPassword(e.target.value)} required
                      placeholder="••••••••"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    />
                  </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">💳 Billing & Package plan</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monthly Fee (INR)</label>
                    <input 
                      type="number" value={newClinicFee} onChange={e => setNewClinicFee(Number(e.target.value))} required
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Subscription Status</label>
                    <select 
                      value={newClinicStatus} onChange={e => setNewClinicStatus(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial Period</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Package Tier</label>
                    <select 
                      value={newClinicTier} onChange={e => setNewClinicTier(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    >
                      <option value="Essential">Essential Package</option>
                      <option value="Professional">Professional Package (Custom Branding)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-brand-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Complete Provisioning'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-black rounded-2xl transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Directory List of Clinics */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black dark:text-white tracking-tight">Active Platform Tenants</h2>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-850 px-3 py-1.5 rounded-full">
              {clinics.length} clinics registered
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {clinics.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-20 rounded-[3rem] border border-slate-200/50 dark:border-slate-800 text-center text-slate-450 font-bold">
                No clinics registered on the platform.
              </div>
            ) : (
              clinics.map(clinic => {
                const isProfessional = clinic.tier === 'Professional';
                const status = clinic.subscription_status || 'active';
                return (
                  <div 
                    key={clinic.id} 
                    className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-150 dark:border-slate-800 shadow-sm group hover:shadow-xl transition-all duration-300"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-center">
                      
                      {/* Name and Phone ID details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-black dark:text-white">{clinic.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                            isProfessional 
                              ? 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' 
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {clinic.tier || 'Essential'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 size={12} /> ID: {clinic.phone_number_id || clinic.id}
                        </p>
                        {clinic.emails && clinic.emails.length > 0 && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            {clinic.emails.map(email => (
                              <div key={email} className="flex items-center gap-2">
                                <p className="text-[10px] text-brand-500 dark:text-brand-400 font-bold uppercase tracking-wider flex items-center gap-1.5" title="Associated Admin User Email">
                                  <Mail size={12} /> {email}
                                </p>
                                <button
                                  onClick={() => handleResetPassword(email)}
                                  className="p-1 text-slate-400 hover:text-brand-500 bg-slate-50 dark:bg-slate-850 hover:bg-brand-50 dark:hover:bg-brand-950/20 rounded-md transition-all active:scale-95"
                                  title="Reset Password"
                                >
                                  <Key size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Contact metadata info */}
                      <div className="space-y-1 text-xs font-bold text-slate-500 dark:text-slate-450">
                        {clinic.phone && <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {clinic.phone}</p>}
                        {clinic.address && <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {clinic.address}</p>}
                        {clinic.created_date && <p className="flex items-center gap-2"><Calendar size={14} className="text-slate-400" /> Created: {clinic.created_date}</p>}
                      </div>

                      {/* Financial billing configuration */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monthly Fee</span>
                          <p className="text-sm font-black dark:text-white">₹{clinic.monthly_fee || 0}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Billing Status</span>
                          <div>
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              status === 'active' 
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                : status === 'trial'
                                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                                  : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                            }`}>
                              {status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controls action buttons */}
                      <div className="flex flex-col sm:row gap-4 justify-end lg:flex-row">
                        <div className="space-y-1 flex-1 lg:flex-initial">
                          <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Change Plan</span>
                          <select 
                            value={clinic.tier || 'Essential'} 
                            onChange={e => handleUpdateTier(clinic.phone_number_id, e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold transition-all outline-none dark:text-white"
                          >
                            <option value="Essential">Essential</option>
                            <option value="Professional">Professional</option>
                          </select>
                        </div>

                        <div className="space-y-1 flex-1 lg:flex-initial">
                          <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Change Status</span>
                          <select 
                            value={status} 
                            onChange={e => handleUpdateStatus(clinic.phone_number_id, e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold transition-all outline-none dark:text-white"
                          >
                            <option value="active">Active</option>
                            <option value="trial">Trial</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>

                        <button 
                          onClick={() => handleDeleteClinic(clinic.phone_number_id, clinic.name)}
                          className="p-3 text-slate-400 hover:text-rose-500 bg-slate-50 dark:bg-slate-850 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all self-end active:scale-95 flex items-center justify-center"
                          title="Delete Clinic"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
