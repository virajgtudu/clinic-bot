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
          wait_time_mins: calculateWaitTime(appt.created_at),
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

  const callNext = async () => {
    const nextPatient = queue.find(p => p.status === 'waiting' || p.status === 'emergency');
    if (nextPatient) {
      try {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'Serving' })
          .eq('id', nextPatient.id);
        if (error) throw error;
        // Optimistic update
        setQueue(prev => prev.map(p => p.id === nextPatient.id ? { ...p, status: 'serving' } : p));
      } catch (err) {
        console.error('Error calling next:', err);
      }
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

  const addWalkIn = async (name: string, phone: string = 'walk-in', age: number = 0, doctorId: string, time?: string) => {
    if (!profile?.clinic_id) return;
    
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

function calculateWaitTime(createdAt: string) {
  const start = new Date(createdAt).getTime();
  const now = new Date().getTime();
  return Math.floor((now - start) / (1000 * 60));
}
