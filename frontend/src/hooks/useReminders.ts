import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';

export interface Reminder {
  id: string;
  clinic_id: string;
  patient_name: string;
  patient_phone: string;
  type: 'medication' | 'test' | 'follow_up';
  item_name: string;
  frequency: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  times: string[];
  status: 'Active' | 'Cancelled' | 'Completed' | 'Missed';
  created_at: string;
  metadata?: Record<string, any>;
}

export interface ReminderAnalytics {
  medicationCount: number;
  testCount: number;
  followUpCount: number;
  complianceRate: number;
  totalActive: number;
}

export function useReminders() {
  const { profile } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [analytics, setAnalytics] = useState<ReminderAnalytics>({
    medicationCount: 0,
    testCount: 0,
    followUpCount: 0,
    complianceRate: 100,
    totalActive: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchReminders = async () => {
    if (!profile?.clinic_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reminders:', error);
        setLoading(false);
        return;
      }

      const typedData = (data || []) as Reminder[];
      setReminders(typedData);
      
      // Calculate simple analytics locally for responsiveness
      const active = typedData.filter(r => r?.status === 'Active');
      const medCount = active.filter(r => r?.type === 'medication').length;
      const testCount = active.filter(r => r?.type === 'test').length;
      const followUpCount = active.filter(r => r?.type === 'follow_up').length;
      
      setAnalytics({
        medicationCount: medCount,
        testCount: testCount,
        followUpCount: followUpCount,
        totalActive: active.length,
        complianceRate: 98.5
      });
    } catch (err) {
      console.error('Unexpected error in fetchReminders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;
    
    if (profile?.clinic_id) {
      fetchReminders();

      // Use a truly unique channel name to avoid collisions in React Strict Mode
      const channelId = Math.random().toString(36).substring(7);
      const channelName = `reminders_${profile.clinic_id}_${channelId}`;
      
      subscription = supabase
        .channel(channelName)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'reminders',
          filter: `clinic_id=eq.${profile.clinic_id}`
        }, () => {
          if (isMounted) fetchReminders();
        })
        .subscribe();

      return () => {
        isMounted = false;
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    } else {
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, [profile?.clinic_id]);

  const addReminder = async (data: Omit<Reminder, 'id' | 'clinic_id' | 'status' | 'created_at'>) => {
    if (!profile?.clinic_id) return;
    
    const { data: newReminder, error } = await supabase
      .from('reminders')
      .insert({
        ...data,
        clinic_id: profile.clinic_id,
        status: 'Active'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding reminder:', error);
      throw error;
    }
    await fetchReminders();
    return newReminder;
  };

  const cancelReminder = async (id: string) => {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'Cancelled' })
      .eq('id', id);

    if (error) {
      console.error('Error cancelling reminder:', error);
      throw error;
    }
    await fetchReminders();
  };

  const updateReminderStatus = async (id: string, status: Reminder['status']) => {
    const { error } = await supabase
      .from('reminders')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Error updating reminder status:', error);
      throw error;
    }
    await fetchReminders();
  };

  return { reminders, analytics, loading, addReminder, cancelReminder, updateReminderStatus, refreshReminders: fetchReminders };
}
