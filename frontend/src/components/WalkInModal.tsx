import React, { useState, useEffect } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, phone: string, age: number, doctorId: string, time: string) => Promise<any>;
  doctors: any[];
}

export function WalkInModal({ isOpen, onClose, onSubmit, doctors }: WalkInModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<string>('');
  const [doctorId, setDoctorId] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
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
      let timeToUse = selectedTime || new Date().toLocaleTimeString('en-US', { 
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      // Convert to 24h format for consistent DB comparison (e.g., "04:00 PM" -> "16:00")
      try {
        const [time, modifier] = timeToUse.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = (parseInt(hours, 10) + 12).toString();
        timeToUse = `${hours.padStart(2, '0')}:${minutes}`;
      } catch (err) {
        console.warn('Time conversion failed, sending raw:', timeToUse);
      }

      await onSubmit(name, phone || 'walk-in', parseInt(age) || 0, doctorId, timeToUse);
      setName('');
      setPhone('');
      setAge('');
      setSelectedTime('');
      onClose();
    } catch (error) {
      console.error('Error adding walk-in:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDoctorSlots = () => {
    const doc = doctors.find(d => d.id === doctorId);
    if (!doc?.availability_json) return [];
    
    const avail = doc.availability_json;
    
    // Handle new schema (version 2.0)
    if (avail.version === "2.0") {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayName = days[new Date().getDay()];
      const dayConfig = avail.weekly?.[todayName];

      if (!dayConfig?.enabled) return [];

      const sessions = dayConfig.sessions || [];
      const duration = avail.consultation_duration || 15;
      const allSlots: string[] = [];

      sessions.forEach((sess: any) => {
        if (!sess.start || !sess.end) return;
        
        try {
          // Simple time generator for the UI
          const parseTime = (t: string) => {
            const [time, modifier] = t.split(' ');
            let [h, m] = time.split(':').map(Number);
            if (modifier === 'PM' && h < 12) h += 12;
            if (modifier === 'AM' && h === 12) h = 0;
            return h * 60 + m;
          };

          const formatTime = (totalMin: number) => {
            let h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            const modifier = h >= 12 ? 'PM' : 'AM';
            if (h > 12) h -= 12;
            if (h === 0) h = 12;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${modifier}`;
          };

          let current = parseTime(sess.start);
          const end = parseTime(sess.end);

          while (current < end) {
            allSlots.push(formatTime(current));
            current += duration;
          }
        } catch (e) {
          console.error('Error generating walk-in slots:', e);
        }
      });
      return allSlots;
    }

    // Backward compatibility: handle old list-based structure
    const firstDay = Object.values(doc.availability_json)[0] as any;
    return firstDay?.slots || [];
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

              <div className="grid grid-cols-2 gap-4">
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
                      <option key={doc.id} value={doc.id}>{doc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Appt. Time</label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-brand-500/30 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-sm font-bold transition-all outline-none dark:text-white cursor-pointer"
                  >
                    <option value="">Current Time</option>
                    {getDoctorSlots().map((slot: string) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
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
