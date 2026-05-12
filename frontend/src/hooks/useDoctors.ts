import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';

export interface Doctor {
  id: string;
  clinic_id: string;
  name: string;
  specialty: string;
  availability_json: any;
  created_at: string;
}

export function useDoctors() {
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDoctors = async () => {
    if (!profile?.clinic_id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching doctors:', error);
    } else {
      setDoctors(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDoctors();
  }, [profile?.clinic_id]);

  const addDoctor = async (doctor: Partial<Doctor>) => {
    if (!profile?.clinic_id) return;

    const { data, error } = await supabase
      .from('doctors')
      .insert([{ ...doctor, clinic_id: profile.clinic_id }])
      .select();

    if (error) {
      console.error('Error adding doctor:', error);
      throw error;
    }
    setDoctors([...doctors, data[0]]);
    return data[0];
  };

  const updateDoctor = async (id: string, updates: Partial<Doctor>) => {
    const { error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating doctor:', error);
      throw error;
    }
    setDoctors(doctors.map(d => (d.id === id ? { ...d, ...updates } : d)));
  };

  const deleteDoctor = async (id: string) => {
    const { error } = await supabase
      .from('doctors')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting doctor:', error);
      throw error;
    }
    setDoctors(doctors.filter(d => d.id !== id));
  };

  return { doctors, loading, addDoctor, updateDoctor, deleteDoctor, refresh: fetchDoctors };
}
