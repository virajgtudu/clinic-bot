import React, { useState, useEffect } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, phone: string, age: number, doctorId: string) => Promise<any>;
  doctors: any[];
}

export function WalkInModal({ isOpen, onClose, onSubmit, doctors }: WalkInModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<string>('');
  const [doctorId, setDoctorId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (doctors.length > 0 && !doctorId) {
      setDoctorId(doctors[0].id);
    }
  }, [doctors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !doctorId) return;

    setLoading(true);
    try {
      await onSubmit(name, phone || 'walk-in', parseInt(age) || 0, doctorId);
      setName('');
      setPhone('');
      setAge('');
      onClose();
    } catch (error) {
      console.error('Error adding walk-in:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800"
          >
            <button
              onClick={onClose}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black dark:text-white">Add Walk-in</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Instant Queue Entry</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Patient Full Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter patient name..."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Mobile (Optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="91..."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Consulting Doctor</label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white cursor-pointer"
                  required
                >
                  <option value="" disabled>Select Doctor</option>
                  {doctors.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.name} ({doc.specialty})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim() || !doctorId}
                className="w-full py-4 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Add to Queue'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
