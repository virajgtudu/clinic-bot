import { useState } from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientPhone: string;
  onSubmit: (days: number) => Promise<void>;
}

export function FollowUpModal({ isOpen, onClose, patientName, onSubmit }: FollowUpModalProps) {
  const [days, setDays] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const options = [
    { label: '1 Day', value: 1 },
    { label: '2 Days', value: 2 },
    { label: '3 Days', value: 3 },
    { label: '5 Days', value: 5 },
    { label: '7 Days', value: 7 },
    { label: '14 Days', value: 14 },
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(days);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to set follow-up.');
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
            <h3 className="text-xl font-black dark:text-white tracking-tight">SET FOLLOW-UP</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">For {patientName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  "py-4 rounded-2xl font-bold text-sm transition-all border-2",
                  days === opt.value 
                    ? "border-brand-500 bg-brand-500/5 text-brand-500" 
                    : "border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-brand-500 shadow-sm">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notification Time</p>
              <p className="text-sm font-bold dark:text-white">Scheduled for 08:00 AM</p>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
            >
              CANCEL
            </button>
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-[2] py-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-2xl font-black transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : 'CONFIRM'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
