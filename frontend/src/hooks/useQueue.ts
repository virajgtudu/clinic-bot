import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';

export interface Patient {
  id: string;
  token: string | number;
  name: string;
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
    if (!profile?.clinic_id) return;

    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .eq('booking_date', today)
      .order('token', { ascending: true });

    if (error) {
      console.error('Error fetching queue:', error);
      return;
    }

    const mappedQueue: Patient[] = data.map((appt: any) => ({
      id: appt.id,
      token: appt.token,
      name: appt.patient_name,
      status: appt.status.toLowerCase() as any,
      source: appt.source === 'walkin' ? 'walk-in' : 'whatsapp',
      wait_time_mins: calculateWaitTime(appt.created_at),
      doctor_id: appt.doctor_id,
      created_at: appt.created_at
    }));

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
    await supabase
      .from('appointments')
      .update({ status: 'Completed' })
      .eq('id', id);
  };

  const callNext = async () => {
    const nextPatient = queue.find(p => p.status === 'waiting' || p.status === 'emergency');
    if (nextPatient) {
      await supabase
        .from('appointments')
        .update({ status: 'Serving' })
        .eq('id', nextPatient.id);
    }
  };

  const prioritize = async (id: string) => {
    await supabase
      .from('appointments')
      .update({ status: 'Emergency' })
      .eq('id', id);
  };

  const addWalkIn = async (name: string) => {
    if (!profile?.clinic_id) return;
    
    // We should ideally call the RPC here to get an atomic token
    const today = new Date().toISOString().split('T')[0];
    const { data: token, error } = await supabase.rpc('create_appointment', {
      p_clinic_id: profile.clinic_id,
      p_doctor_id: 'General', // Default for walk-ins if not specified
      p_name: name,
      p_phone: 'walk-in',
      p_date: today,
      p_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      p_source: 'walkin'
    });

    if (error) console.error('Error adding walk-in:', error);
    return token;
  };

  return { queue, loading, markCompleted, callNext, prioritize, addWalkIn };
}

function calculateWaitTime(createdAt: string) {
  const start = new Date(createdAt).getTime();
  const now = new Date().getTime();
  return Math.floor((now - start) / (1000 * 60));
}
