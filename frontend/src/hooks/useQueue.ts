import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';

export interface Patient {
  id: string;
  token: string | number;
  name: string;
  phone: string;
  booking_time: string;
  status: 'waiting' | 'serving' | 'emergency' | 'completed' | 'cancelled';
  source: 'whatsapp' | 'walk-in';
  wait_time_mins: number;
  doctor_id: string;
  created_at: string;
}

export function useQueue() {
  const { profile } = useAuth();
  const [queue, setQueue] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    if (!profile?.clinic_id) {
      setLoading(false);
      return;
    }

    // Get today's date in IST (Asia/Kolkata)
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    console.log('useQueue: Fetching for clinic_id:', profile.clinic_id, 'Date:', today);
    setLoading(true);
    
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .eq('booking_date', today)
      .order('token', { ascending: true });

    if (error) {
      console.error('Error fetching queue:', error);
      setLoading(false);
      return;
    }

    const mappedQueue: Patient[] = data.map((appt: any) => {
      try {
        const dbStatus = (appt.status || 'Pending').toLowerCase();
        return {
          id: appt.id,
          token: appt.token,
          name: appt.patient_name || 'Unknown Patient',
          phone: appt.phone || '',
          booking_time: appt.booking_time || '',
          status: dbStatus === 'pending' ? 'waiting' : dbStatus as any,
          source: appt.source === 'walkin' ? 'walk-in' : 'whatsapp',
          wait_time_mins: calculateWaitTime(appt.booking_date, appt.booking_time, appt.created_at),
          doctor_id: appt.doctor_id,
          created_at: appt.created_at
        };
      } catch (err) {
        console.error('Error mapping appointment:', appt, err);
        return null;
      }
    }).filter(Boolean) as Patient[];

    console.log('useQueue: Mapped queue size:', mappedQueue.length);
    setQueue(mappedQueue);
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();

    if (!profile?.clinic_id) return;

    // Real-time subscription
    const subscription = supabase
      .channel('queue_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments',
        filter: `clinic_id=eq.${profile.clinic_id}`
      }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.clinic_id]);

  const markCompleted = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Completed' })
        .eq('id', id);
      if (error) throw error;
      // Optimistic update
      setQueue(prev => prev.map(p => p.id === id ? { ...p, status: 'completed' } : p));
    } catch (err) {
      console.error('Error marking completed:', err);
    }
  };

  const callNext = async (doctorId?: string) => {
    const currentlyServing = queue.find(p => 
      p.status === 'serving' && 
      (!doctorId || p.doctor_id === doctorId)
    );
    const nextPatient = queue.find(p => 
      (p.status === 'waiting' || p.status === 'emergency') && 
      (!doctorId || p.doctor_id === doctorId)
    );

    try {
      if (currentlyServing) {
        const { error: completeErr } = await supabase
          .from('appointments')
          .update({ status: 'Pending' })
          .eq('id', currentlyServing.id);
        if (completeErr) throw completeErr;
      }

      if (nextPatient) {
        const { error: serveErr } = await supabase
          .from('appointments')
          .update({ status: 'Serving' })
          .eq('id', nextPatient.id);
        if (serveErr) throw serveErr;
      }

      // Optimistic update
      setQueue(prev => prev.map(p => {
        if (currentlyServing && p.id === currentlyServing.id) {
          return { ...p, status: 'waiting' };
        }
        if (nextPatient && p.id === nextPatient.id) {
          return { ...p, status: 'serving' };
        }
        return p;
      }));
    } catch (err) {
      console.error('Error calling next:', err);
    }
  };

  const prioritize = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Emergency' })
        .eq('id', id);
      if (error) throw error;
      // Optimistic update
      setQueue(prev => prev.map(p => p.id === id ? { ...p, status: 'emergency' } : p));
    } catch (err) {
      console.error('Error prioritizing:', err);
    }
  };

  const addWalkIn = async (name: string, phone: string = 'walk-in', age: number = 0, doctorId: string, time?: string, patientId?: string) => {
    if (!profile?.clinic_id) return;
    
    // If a custom Patient ID is provided, check/insert patient first
    if (patientId && patientId.trim()) {
      const serial = patientId.trim().toUpperCase();
      try {
        const { data: existing } = await supabase
          .from('patients')
          .select('id, name, phone, age')
          .eq('clinic_id', profile.clinic_id)
          .eq('patient_id_serial', serial)
          .maybeSingle();

        if (!existing) {
          const { error: insertErr } = await supabase
            .from('patients')
            .insert({
              clinic_id: profile.clinic_id,
              patient_id_serial: serial,
              name,
              phone: phone || 'walk-in',
              age: age || 0
            });
          if (insertErr) {
            console.error('Error inserting manual patient ID:', insertErr);
          }
        } else {
          if (existing.name !== name || existing.phone !== phone || existing.age !== age) {
            const { error: updateErr } = await supabase
              .from('patients')
              .update({
                name,
                phone: phone || 'walk-in',
                age: age || 0
              })
              .eq('id', existing.id);
            if (updateErr) {
              console.error('Error updating patient details by ID:', updateErr);
            }
          }
        }
      } catch (err) {
        console.error('Failed to verify/insert patient by ID:', err);
      }
    }
    
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const timeToUse = time || new Date().toLocaleTimeString('en-US', { 
      timeZone: 'Asia/Kolkata',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const { data, error } = await supabase.rpc('create_appointment', {
      p_clinic_id: profile.clinic_id,
      p_doctor_id: doctorId,
      p_name: name,
      p_phone: phone,
      p_age: age,
      p_date: today,
      p_time: timeToUse,
      p_source: 'walkin'
    });

    if (error) {
      console.error('Error adding walk-in:', error);
      throw error;
    }
    return data; 
  };

  return { queue, loading, markCompleted, callNext, prioritize, addWalkIn };
}

function parseBookingTime(bookingDate: string, bookingTime: string): Date | null {
  if (!bookingTime) return null;
  try {
    const match = bookingTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;

    let [_, hoursStr, minutesStr, ampm] = match;
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (ampm.toUpperCase() === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }

    const [year, month, day] = bookingDate.split('-').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  } catch (err) {
    console.error('Error parsing booking time:', bookingTime, err);
    return null;
  }
}

function calculateWaitTime(bookingDate: string, bookingTime: string, createdAt: string) {
  if (bookingTime && bookingDate) {
    const parsed = parseBookingTime(bookingDate, bookingTime);
    if (parsed) {
      const start = parsed.getTime();
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / (1000 * 60));
      return diff > 0 ? diff : 0;
    }
  }
  
  try {
    const start = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / (1000 * 60));
    return diff > 0 ? diff : 0;
  } catch (e) {
    return 0;
  }
}
