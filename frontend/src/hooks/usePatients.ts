import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';

export interface PatientRecord {
  id: string;
  clinic_id: string;
  patient_id_serial: string;
  name: string;
  phone: string;
  age: number;
  created_at: string;
  visit_count?: number;
  last_visit?: string;
}

export function usePatients() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    newThisMonth: 0,
    activeThisWeek: 0
  });

  const fetchPatients = async (searchTerm = '') => {
    if (!profile?.clinic_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('patients')
        .select(`
          *,
          appointments(id, created_at)
        `)
        .eq('clinic_id', profile.clinic_id);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,patient_id_serial.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const processed: PatientRecord[] = (data || []).map((p: any) => {
        const sortedAppts = (p.appointments || []).sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        return {
          ...p,
          visit_count: sortedAppts.length,
          last_visit: sortedAppts[0]?.created_at || p.created_at
        };
      });

      setPatients(processed);

      // Calculate stats
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      setStats({
        total: processed.length,
        newThisMonth: processed.filter(p => new Date(p.created_at) >= monthStart).length,
        activeThisWeek: processed.filter(p => new Date(p.last_visit!) >= weekAgo).length
      });

    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [profile?.clinic_id]);

  const getPatientHistory = async (patientId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  };

  return { patients, loading, stats, fetchPatients, getPatientHistory };
}
