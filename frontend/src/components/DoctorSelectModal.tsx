import { useState } from 'react';
import { X, User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Doctor } from '../hooks/useDoctors';

interface DoctorSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctors: Doctor[];
  onSelect: (doctorId: string) => Promise<void>;
}

export function DoctorSelectModal({ isOpen, onClose, doctors, onSelect }: DoctorSelectModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelect = async (doctorId: string) => {
    setSubmitting(true);
    try {
      await onSelect(doctorId);
      onClose();
    } catch (err) {
      console.error('Failed to trigger next patient for doctor:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-brand-500/5 to-transparent">
          <div>
            <h3 className="text-xl font-black dark:text-white tracking-tight">SELECT DOCTOR</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">For which doctor should the next patient be called?</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {doctors.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleSelect(doc.id)}
                disabled={submitting}
                className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-500/5 text-slate-700 dark:text-slate-300 font-bold text-left transition-all flex items-center gap-3 active:scale-[0.98] disabled:opacity-50 group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-brand-500 group-hover:bg-brand-500/10 transition-colors">
                  <User size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 dark:text-white transition-colors group-hover:text-brand-500">{doc.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{doc.specialty}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2">
            <button 
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-black text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
