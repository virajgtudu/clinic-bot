import React, { useState } from 'react';
import { X, Pill, FileText, Calendar, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface CreateReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export function CreateReminderModal({ isOpen, onClose, onSubmit }: CreateReminderModalProps) {
  const [type, setType] = useState<'medication' | 'test' | 'follow_up'>('medication');
  const [formData, setFormData] = useState({
    patient_name: '',
    patient_phone: '',
    item_name: '',
    frequency: 'Once',
    duration_days: 5,
    start_date: new Date().toISOString().split('T')[0],
    times: ['09:00']
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const duration = Number(formData.duration_days);
      const start = new Date(formData.start_date);
      const end = new Date(start);
      end.setDate(start.getDate() + duration - 1);

      await onSubmit({
        ...formData,
        type,
        duration_days: duration,
        end_date: end.toISOString().split('T')[0],
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to create reminder. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const addTime = () => {
    if (formData.times.length < 3) {
      setFormData({ ...formData, times: [...formData.times, '09:00'] });
    }
  };

  const removeTime = (index: number) => {
    const newTimes = formData.times.filter((_, i) => i !== index);
    setFormData({ ...formData, times: newTimes });
  };

  const updateTime = (index: number, val: string) => {
    const newTimes = [...formData.times];
    newTimes[index] = val;
    setFormData({ ...formData, times: newTimes });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-brand-500/5 to-transparent">
          <div>
            <h3 className="text-2xl font-black dark:text-white tracking-tight">NEW REMINDER</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Configure automated WhatsApp alerts for your patient.</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Type Selection */}
          <div className="grid grid-cols-3 gap-4">
            <TypeOption 
              active={type === 'medication'} 
              onClick={() => setType('medication')}
              icon={<Pill size={20} />}
              label="Medication"
            />
            <TypeOption 
              active={type === 'test'} 
              onClick={() => setType('test')}
              icon={<FileText size={20} />}
              label="Test"
            />
            <TypeOption 
              active={type === 'follow_up'} 
              onClick={() => setType('follow_up')}
              icon={<Calendar size={20} />}
              label="Follow-up"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Patient Name</label>
              <input 
                required
                type="text" 
                placeholder="Full Name"
                className="w-full px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 dark:text-white font-bold"
                value={formData.patient_name}
                onChange={e => setFormData({ ...formData, patient_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
              <input 
                required
                type="tel" 
                placeholder="91XXXXXXXXXX"
                className="w-full px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 dark:text-white font-bold"
                value={formData.patient_phone}
                onChange={e => setFormData({ ...formData, patient_phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
              {type === 'medication' ? 'Medicine Name' : type === 'test' ? 'Test Name' : 'Follow-up Reason'}
            </label>
            <input 
              required
              type="text" 
              placeholder={type === 'medication' ? "Paracetamol 500mg" : "Full Body Checkup"}
              className="w-full px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 dark:text-white font-bold"
              value={formData.item_name}
              onChange={e => setFormData({ ...formData, item_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Frequency</label>
              <select 
                className="w-full px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 dark:text-white font-bold appearance-none"
                value={formData.frequency}
                onChange={e => setFormData({ ...formData, frequency: e.target.value })}
              >
                <option>Once</option>
                <option>Twice</option>
                <option>Thrice</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Duration (Days)</label>
              <input 
                type="number" 
                min="1"
                max="30"
                className="w-full px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 dark:text-white font-bold"
                value={formData.duration_days}
                onChange={e => setFormData({ ...formData, duration_days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
              <input 
                type="date" 
                className="w-full px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500/20 dark:text-white font-bold"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between ml-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Daily Alert Times</label>
              {formData.times.length < 3 && (
                <button type="button" onClick={addTime} className="text-brand-500 text-xs font-black uppercase tracking-wider hover:underline">+ Add Time</button>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              {formData.times.map((time, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl group">
                  <Clock size={16} className="text-slate-400" />
                  <input 
                    type="time" 
                    className="bg-transparent border-none p-0 text-sm font-bold dark:text-white focus:ring-0"
                    value={time}
                    onChange={e => updateTime(index, e.target.value)}
                  />
                  {formData.times.length > 1 && (
                    <button type="button" onClick={() => removeTime(index)} className="text-slate-300 hover:text-red-500">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
            >
              CANCEL
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-[2] py-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-2xl font-black transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
            >
              {submitting ? 'CREATING...' : 'CREATE REMINDER'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TypeOption({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
        active 
          ? "border-brand-500 bg-brand-500/5 text-brand-500" 
          : "border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200"
      )}
    >
      {icon}
      <span className="text-xs font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
