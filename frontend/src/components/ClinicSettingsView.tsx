import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  UserPlus, 
  Settings, 
  AlertCircle, 
  Stethoscope, 
  Loader2, 
  ShieldCheck,
  Upload,
  Lock,
  Building2,
  Palette,
  MessageSquare,
  Calendar,
  Globe,
  Eye,
  ChevronRight,
  Phone,
  MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from './AuthContext';
import { useDoctors } from '../hooks/useDoctors';
import type { Doctor } from '../hooks/useDoctors';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

// Helper to convert file to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export function ClinicSettings({ onManageAvailability }: { onManageAvailability: () => void }) {
  const { profile, session } = useAuth();
  
  // General State
  const [tier, setTier] = useState('Essential');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Clinic Info State
  const [clinicName, setClinicName] = useState(profile?.full_name || '');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicWebsite, setClinicWebsite] = useState('');

  // 2. Custom Branding State
  const [logoUrl, setLogoUrl] = useState(''); // Base64 data URL
  const [colorType, setColorType] = useState<'blue' | 'green' | 'purple' | 'red' | 'custom'>('blue');
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9');
  const [signature, setSignature] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // 3. Message Templates
  const [templateAppointment, setTemplateAppointment] = useState('');
  const [templateMedicine, setTemplateMedicine] = useState('');
  const [templateFollowup, setTemplateFollowup] = useState('');
  const [templateTest, setTemplateTest] = useState('');

  // 4. Queue Board Settings
  const [marqueeText, setMarqueeText] = useState('');
  const [qbShowLogo, setQbShowLogo] = useState(true);
  const [qbShowDoctorPhoto, setQbShowDoctorPhoto] = useState(true);
  const [qbShowAddress, setQbShowAddress] = useState(true);
  const [qbShowTime, setQbShowTime] = useState(true);

  // Live Preview Tab State
  const [previewTab, setPreviewTab] = useState<'welcome' | 'appointment' | 'medicine' | 'followup' | 'test'>('welcome');

  // Load Configurations
  useEffect(() => {
    const fetchClinicData = async () => {
      if (!profile?.clinic_id) return;
      try {
        const { data, error } = await supabase
          .from('clinics')
          .select('branding_json, tier, name')
          .eq('id', profile.clinic_id)
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          setTier(data.tier || 'Essential');
          if (data.name) setClinicName(data.name);

          if (data.branding_json) {
            const b = data.branding_json;
            setLogoUrl(b.logo_url || '');
            setSignature(b.signature || '');
            setMarqueeText(b.marquee_text || '');
            setClinicPhone(b.clinic_phone || '');
            setClinicAddress(b.clinic_address || '');
            setClinicWebsite(b.clinic_website || '');
            setWelcomeMessage(b.welcome_message || '');
            
            setTemplateAppointment(b.templates?.appointment || '');
            setTemplateMedicine(b.templates?.medicine || '');
            setTemplateFollowup(b.templates?.followup || '');
            setTemplateTest(b.templates?.test || '');

            setQbShowLogo(b.queue_board?.show_logo !== false);
            setQbShowDoctorPhoto(b.queue_board?.show_doctor_photo !== false);
            setQbShowAddress(b.queue_board?.show_address !== false);
            setQbShowTime(b.queue_board?.show_time !== false);

            const color = b.primary_color || '#0ea5e9';
            setPrimaryColor(color);
            if (color === '#0ea5e9') setColorType('blue');
            else if (color === '#10b981') setColorType('green');
            else if (color === '#8b5cf6') setColorType('purple');
            else if (color === '#ef4444') setColorType('red');
            else setColorType('custom');
          }
        }
      } catch (err) {
        console.error('Failed to load clinic branding configurations:', err);
      }
    };
    fetchClinicData();
  }, [profile?.clinic_id]);

  // Handle Preset Theme selections
  const handleColorTypeChange = (type: 'blue' | 'green' | 'purple' | 'red' | 'custom') => {
    setColorType(type);
    if (type === 'blue') setPrimaryColor('#0ea5e9');
    else if (type === 'green') setPrimaryColor('#10b981');
    else if (type === 'purple') setPrimaryColor('#8b5cf6');
    else if (type === 'red') setPrimaryColor('#ef4444');
  };

  // Handle Logo Upload and convert to base64
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        alert('Image must be under 800KB. Please resize or compress the logo.');
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        setLogoUrl(base64);
      } catch (err) {
        console.error('Failed to process image file:', err);
        alert('Failed to read logo image.');
      }
    }
  };

  // Upgrade Plan Helper
  const handleUpgrade = async () => {
    if (!profile?.clinic_id || !session?.access_token) return;
    setIsUpgrading(true);
    try {
      const rawApiUrl = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://' + window.location.host);
      const apiUrl = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

      const response = await fetch(`${apiUrl}/api/clinic/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to upgrade. Please contact administrator.');
      }

      setTier('Professional');
      alert('🎉 Congratulations! You have successfully upgraded to the Professional Package! Custom Branding features are now unlocked.');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to upgrade: ${err.message || 'Please contact support.'}`);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Save Unified Configurations
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.clinic_id) return;
    setIsSaving(true);
    try {
      const branding = {
        logo_url: logoUrl,
        primary_color: primaryColor,
        signature,
        marquee_text: marqueeText,
        clinic_phone: clinicPhone,
        clinic_address: clinicAddress,
        clinic_website: clinicWebsite,
        welcome_message: welcomeMessage,
        templates: {
          appointment: templateAppointment,
          medicine: templateMedicine,
          followup: templateFollowup,
          test: templateTest
        },
        queue_board: {
          show_logo: qbShowLogo,
          show_doctor_photo: qbShowDoctorPhoto,
          show_address: qbShowAddress,
          show_time: qbShowTime
        }
      };

      // 1. Update Clinics Table
      const { error: clinicErr } = await supabase
        .from('clinics')
        .update({ 
          name: clinicName,
          branding_json: branding 
        })
        .eq('id', profile.clinic_id);
      if (clinicErr) throw clinicErr;

      // 2. Update Profiles Table
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: clinicName })
        .eq('id', profile.id);
      if (profileErr) throw profileErr;

      alert('All clinic and branding settings updated successfully!');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save settings: ${err.message || 'Please check database schema cache.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Render Formatted Preview Text
  const getPreviewMessageText = () => {
    if (previewTab === 'welcome') {
      return welcomeMessage || `Welcome to ${clinicName || 'Apollo Health Clinic'}.\n\nChoose an option:\n1️⃣ Book Appointment\n2️⃣ Check Queue\n3️⃣ Contact Clinic`;
    }
    if (previewTab === 'appointment') {
      const tpl = templateAppointment || "Hello {patient_name}, your appointment with {doctor_name} is confirmed for {booking_time}.";
      return tpl
        .replace(/{patient_name}/g, 'Rahul')
        .replace(/{doctor_name}/g, 'Dr. Sharma')
        .replace(/{booking_time}/g, 'Tomorrow at 10:30 AM');
    }
    if (previewTab === 'medicine') {
      const tpl = templateMedicine || "Hi {patient_name}, this is a reminder to take your medicine {medicine_name} ({dosage}).";
      let msg = tpl
        .replace(/{patient_name}/g, 'Rahul')
        .replace(/{medicine_name}/g, 'Amoxicillin')
        .replace(/{dosage}/g, '1 tablet after breakfast');
      if (signature) {
        msg += `\n\n${signature}`;
      }
      return msg;
    }
    if (previewTab === 'followup') {
      const tpl = templateFollowup || "Hi {patient_name}, this is a reminder for your follow-up appointment with {doctor_name} in {days} days.";
      let msg = tpl
        .replace(/{patient_name}/g, 'Rahul')
        .replace(/{doctor_name}/g, 'Dr. Sharma')
        .replace(/{days}/g, '7');
      if (signature) {
        msg += `\n\n${signature}`;
      }
      return msg;
    }
    if (previewTab === 'test') {
      const tpl = templateTest || "Hi {patient_name}, this is a reminder for your test {test_name}. Instruction: {instructions}.";
      let msg = tpl
        .replace(/{patient_name}/g, 'Rahul')
        .replace(/{test_name}/g, 'Blood Glucose Test')
        .replace(/{instructions}/g, 'Fast for 8 hours before');
      if (signature) {
        msg += `\n\n${signature}`;
      }
      return msg;
    }
    return '';
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl pb-20">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black dark:text-white tracking-tight">Clinic Branding & Settings</h2>
            <span className={cn(
              "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full",
              tier === 'Professional' 
                ? "bg-gradient-to-r from-brand-500 to-indigo-500 text-white shadow-md shadow-brand-500/10" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            )}>
              {tier} Plan
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Configure your clinic details, brand aesthetics, WhatsApp templates, and TV board display</p>
        </div>
        
        <button 
          onClick={onManageAvailability}
          className="px-6 py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-black rounded-2xl shadow-md flex items-center gap-2 active:scale-95 transition-all outline-none"
        >
          Manage Doctor Availability <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Settings Form Column */}
        <div className="lg:col-span-8 space-y-8">
          <form onSubmit={handleSaveChanges} className="space-y-8">
            
            {/* Card 1: Clinic Information (Unlocked) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950/30 text-brand-500 rounded-xl">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black dark:text-white leading-tight">Clinic Information</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Basic profile data used in messages and configurations</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="clinicName" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Clinic Name</label>
                  <input 
                    id="clinicName"
                    type="text" 
                    value={clinicName} 
                    onChange={e => setClinicName(e.target.value)} 
                    placeholder="e.g. Apollo Health Clinic"
                    required
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="clinicPhone" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer flex items-center gap-1">
                      <Phone size={10} /> Clinic Phone
                    </label>
                    <input 
                      id="clinicPhone"
                      type="text" 
                      value={clinicPhone} 
                      onChange={e => setClinicPhone(e.target.value)} 
                      placeholder="e.g. 919876543210"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="clinicWebsite" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer flex items-center gap-1">
                      <Globe size={10} /> Clinic Website (Optional)
                    </label>
                    <input 
                      id="clinicWebsite"
                      type="url" 
                      value={clinicWebsite} 
                      onChange={e => setClinicWebsite(e.target.value)} 
                      placeholder="e.g. https://apolloclinic.com"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="clinicAddress" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer flex items-center gap-1">
                    <MapPin size={10} /> Clinic Address
                  </label>
                  <textarea 
                    id="clinicAddress"
                    rows={3}
                    value={clinicAddress} 
                    onChange={e => setClinicAddress(e.target.value)} 
                    placeholder="e.g. 1st Floor, Apollo Towers, Sector 15, Mumbai"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: WhatsApp Signature (Unlocked) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950/30 text-brand-500 rounded-xl">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black dark:text-white leading-tight">WhatsApp Signature</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Appended automatically to medicine, test, and follow-up reminders</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="whatsappSignature" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Signature Text</label>
                <input 
                  id="whatsappSignature"
                  type="text" 
                  value={signature} 
                  onChange={e => setSignature(e.target.value)} 
                  placeholder="e.g. Regards, Apollo Health Clinic"
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                />
                <p className="text-[9px] text-slate-450 ml-1 font-bold uppercase tracking-wider">Example: Regards, Apollo Health Clinic</p>
              </div>
            </div>

            {/* Card 3: Custom Branding & Theme (Premium Locked) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-xl relative overflow-hidden min-h-[300px]">
              {tier !== 'Professional' && (
                <PremiumLockOverlay 
                  title="Unlock Custom Branding & Logo"
                  desc="Display your own custom clinic logo and choose colors that align with your medical brand identity."
                  onUnlock={handleUpgrade}
                  isUpgrading={isUpgrading}
                />
              )}
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950/30 text-brand-500 rounded-xl">
                  <Palette size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black dark:text-white leading-tight">Custom Branding</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Customize clinic logo and brand color palettes</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Upload Clinic Logo</span>
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="relative shrink-0 w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden shadow-sm">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo preview" className="w-full h-full object-contain p-2" />
                      ) : (
                        <Stethoscope size={32} className="text-slate-350 dark:text-slate-655" />
                      )}
                    </div>
                    
                    <div className="space-y-2 flex-1">
                      <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-sm active:scale-95">
                        <Upload size={14} /> Upload Image
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      </label>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Supports PNG, JPG, or GIF. Max 800KB.</p>
                      {logoUrl && (
                        <button type="button" onClick={() => setLogoUrl('')} className="text-[9px] font-black uppercase text-rose-500 hover:underline block">Remove Logo</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Brand Color Picker */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Color</span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <ColorOption label="Blue" color="#0ea5e9" active={colorType === 'blue'} onClick={() => handleColorTypeChange('blue')} />
                    <ColorOption label="Green" color="#10b981" active={colorType === 'green'} onClick={() => handleColorTypeChange('green')} />
                    <ColorOption label="Purple" color="#8b5cf6" active={colorType === 'purple'} onClick={() => handleColorTypeChange('purple')} />
                    <ColorOption label="Red" color="#ef4444" active={colorType === 'red'} onClick={() => handleColorTypeChange('red')} />
                    <ColorOption label="Custom" active={colorType === 'custom'} onClick={() => setColorType('custom')} custom />
                  </div>

                  {colorType === 'custom' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl w-fit border border-slate-100 dark:border-slate-800">
                      <input 
                        type="color" 
                        value={primaryColor} 
                        onChange={e => setPrimaryColor(e.target.value)} 
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none shrink-0"
                      />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Brand Hex</p>
                        <p className="text-xs font-mono font-black dark:text-white uppercase">{primaryColor}</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Custom Welcome Message (Premium Locked) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-xl relative overflow-hidden min-h-[200px]">
              {tier !== 'Professional' && (
                <PremiumLockOverlay 
                  title="Custom Welcome Greetings"
                  desc="Customize the automated greeting chatbot message sent when new patients contact your WhatsApp line."
                  onUnlock={handleUpgrade}
                  isUpgrading={isUpgrading}
                />
              )}
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950/30 text-brand-500 rounded-xl">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black dark:text-white leading-tight">Welcome Message Greeting</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Customize welcoming chatbot message sent to patients</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="welcomeMessage" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Chatbot Welcome Greeting Message</label>
                <textarea 
                  id="welcomeMessage"
                  rows={4}
                  value={welcomeMessage} 
                  onChange={e => setWelcomeMessage(e.target.value)} 
                  placeholder="Welcome to Apollo Health Clinic.&#10;Choose an option:&#10;1️⃣ Book Appointment&#10;2️⃣ Check Queue&#10;3️⃣ Contact Clinic"
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                />
                <p className="text-[9px] text-slate-400 ml-1 font-bold uppercase tracking-wider">Supports line breaks. Greeting sent when user sends 'Hi', 'Hello' or 'Start'.</p>
              </div>
            </div>

            {/* Card 5: Message Templates (Premium Locked) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-xl relative overflow-hidden min-h-[400px]">
              {tier !== 'Professional' && (
                <PremiumLockOverlay 
                  title="Custom Reminder Wording"
                  desc="Edit the reminder copy and layout templates delivered to patients for medicine doses, tests, and follow-ups."
                  onUnlock={handleUpgrade}
                  isUpgrading={isUpgrading}
                />
              )}
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950/30 text-brand-500 rounded-xl">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black dark:text-white leading-tight">Message Reminder Templates</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Modify the texts sent to patients (keep brackets like {'{patient_name}'} intact)</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Appointment Confirmation Template */}
                <div className="space-y-1.5">
                  <label htmlFor="templateAppointment" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Appointment Confirmation Message</label>
                  <textarea 
                    id="templateAppointment"
                    rows={3}
                    value={templateAppointment} 
                    onChange={e => setTemplateAppointment(e.target.value)} 
                    placeholder="Hello {patient_name}, your appointment with {doctor_name} is confirmed for {booking_time}."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                  />
                  <p className="text-[8px] text-slate-450 font-bold uppercase ml-1">Variables: {'{patient_name}, {doctor_name}, {booking_time}'}</p>
                </div>

                {/* Medicine Dose Template */}
                <div className="space-y-1.5">
                  <label htmlFor="templateMedicine" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Medicine Dose Reminder</label>
                  <textarea 
                    id="templateMedicine"
                    rows={3}
                    value={templateMedicine} 
                    onChange={e => setTemplateMedicine(e.target.value)} 
                    placeholder="Hi {patient_name}, this is a reminder to take your medicine {medicine_name} ({dosage})."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                  />
                  <p className="text-[8px] text-slate-450 font-bold uppercase ml-1">Variables: {'{patient_name}, {medicine_name}, {dosage}'}</p>
                </div>

                {/* Follow-up Reminder Template */}
                <div className="space-y-1.5">
                  <label htmlFor="templateFollowup" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Follow-up Reminder</label>
                  <textarea 
                    id="templateFollowup"
                    rows={3}
                    value={templateFollowup} 
                    onChange={e => setTemplateFollowup(e.target.value)} 
                    placeholder="Hi {patient_name}, this is a reminder for your follow-up appointment with {doctor_name} in {days} days."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                  />
                  <p className="text-[8px] text-slate-455 font-bold uppercase ml-1">Variables: {'{patient_name}, {doctor_name}, {days}'}</p>
                </div>

                {/* Test Reminder Template */}
                <div className="space-y-1.5">
                  <label htmlFor="templateTest" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Diagnostic Test Reminder</label>
                  <textarea 
                    id="templateTest"
                    rows={3}
                    value={templateTest} 
                    onChange={e => setTemplateTest(e.target.value)} 
                    placeholder="Hi {patient_name}, this is a reminder for your test {test_name}. Instruction: {instructions}."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                  />
                  <p className="text-[8px] text-slate-450 font-bold uppercase ml-1">Variables: {'{patient_name}, {test_name}, {instructions}'}</p>
                </div>
              </div>
            </div>

            {/* Card 6: Queue Board Settings (Premium Locked) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-xl relative overflow-hidden min-h-[300px]">
              {tier !== 'Professional' && (
                <PremiumLockOverlay 
                  title="Queue Board Customization"
                  desc="Customize what elements display on the waiting room TV queue display: showing address, clock, photos or custom announcements."
                  onUnlock={handleUpgrade}
                  isUpgrading={isUpgrading}
                />
              )}
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950/30 text-brand-500 rounded-xl">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black dark:text-white leading-tight">Queue Board TV Settings</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Visual preferences and announcement feeds for waiting room TV</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Scrolling Marquee text announcement (Moved here) */}
                <div className="space-y-1.5">
                  <label htmlFor="marqueeText" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Waiting Room TV Marquee Announcement</label>
                  <input 
                    id="marqueeText"
                    type="text" 
                    value={marqueeText} 
                    onChange={e => setMarqueeText(e.target.value)} 
                    placeholder="e.g. HEALTH UPDATE: DEAR PATIENTS, WE NOW OFFER FREE DENTAL CHECK-UPS EVERY SUNDAY!"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500/20 transition-all outline-none dark:text-white"
                  />
                  <p className="text-[9px] text-slate-455 font-bold uppercase tracking-wider ml-1">Displays as a marquee at the bottom of the TV screen.</p>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />
                
                {/* Show details checkboxes */}
                <div className="space-y-3">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TV Board Branding Elements</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CheckboxOption 
                      checked={qbShowLogo} 
                      onChange={setQbShowLogo} 
                      title="Show Clinic Logo" 
                      description="Displays clinic logo in TV header" 
                    />
                    <CheckboxOption 
                      checked={qbShowDoctorPhoto} 
                      onChange={setQbShowDoctorPhoto} 
                      title="Show Doctor Photo" 
                      description="Shows doctor avatar in serving block" 
                    />
                    <CheckboxOption 
                      checked={qbShowAddress} 
                      onChange={setQbShowAddress} 
                      title="Show Clinic Address" 
                      description="Renders address as TV screen footer" 
                    />
                    <CheckboxOption 
                      checked={qbShowTime} 
                      onChange={setQbShowTime} 
                      title="Show Current Time" 
                      description="Displays live clock in TV header" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 7: Enterprise Advanced Settings (Always locked) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-xl relative overflow-hidden min-h-[300px]">
              <EnterpriseLockOverlay 
                title="Scale to Enterprise"
                desc="Unlock Custom Domain bindings, Multi-Branch synchronization, Developer APIs, and full White Label solutions."
              />
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950/30 text-brand-500 rounded-xl">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black dark:text-white leading-tight">Enterprise Advanced settings</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Scale solutions across corporate systems and custom domains</p>
                </div>
              </div>

              <div className="space-y-4 opacity-50 select-none">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custom Domain Name Binding</label>
                  <input type="text" disabled placeholder="e.g. appointments.apolloclinic.com" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <CheckboxOption checked={false} onChange={() => {}} title="White Label Application" description="Hide all ClinicPRO branding completely" />
                  <CheckboxOption checked={false} onChange={() => {}} title="Multi-Branch Management" description="Sync multiple branches and databases" />
                  <CheckboxOption checked={false} onChange={() => {}} title="Developer API Access" description="Access tokens and webhooks" />
                  <CheckboxOption checked={false} onChange={() => {}} title="Dedicated Account Support" description="24/7 priority SLA support agent" />
                </div>
              </div>
            </div>

            {/* Submit save button */}
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full py-4.5 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 outline-none"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : 'Save Changes'}
            </button>

          </form>
        </div>

        {/* Live Preview Column (Sticky) */}
        <div className="lg:col-span-4 space-y-8 sticky top-28">
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Eye size={16} />
              <h4 className="text-xs font-black uppercase tracking-widest">Live WhatsApp Preview</h4>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-455 leading-relaxed font-bold">See exactly how your messages look in real-time on patient mobile screens.</p>
          </div>

          <div className="bg-[#e5ddd5] dark:bg-slate-950 p-4 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-between" style={{ minHeight: '520px' }}>
            {/* Phone header banner */}
            <div className="bg-[#075e54] text-white p-4 -mx-4 -mt-4 flex items-center gap-3 shadow-md shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                🏥
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black truncate">{clinicName || 'Apollo Health Clinic'}</p>
                <p className="text-[8px] text-emerald-100 font-bold">online</p>
              </div>
            </div>

            {/* Preview Tab Selectors */}
            <div className="flex bg-[#dfd7cf]/70 dark:bg-slate-900/50 p-1 rounded-xl gap-1 mt-2 mb-2 shrink-0 overflow-x-auto text-[8px] font-black uppercase tracking-wider">
              <button 
                type="button" 
                onClick={() => setPreviewTab('welcome')} 
                className={cn("px-2 py-1.5 rounded-lg transition-colors flex-1 truncate text-center", previewTab === 'welcome' ? "bg-white dark:bg-slate-800 dark:text-white text-slate-800 shadow-sm" : "text-slate-500")}
              >
                Welcome
              </button>
              <button 
                type="button" 
                onClick={() => setPreviewTab('appointment')} 
                className={cn("px-2 py-1.5 rounded-lg transition-colors flex-1 truncate text-center", previewTab === 'appointment' ? "bg-white dark:bg-slate-800 dark:text-white text-slate-800 shadow-sm" : "text-slate-500")}
              >
                Booking
              </button>
              <button 
                type="button" 
                onClick={() => setPreviewTab('medicine')} 
                className={cn("px-2 py-1.5 rounded-lg transition-colors flex-1 truncate text-center", previewTab === 'medicine' ? "bg-white dark:bg-slate-800 dark:text-white text-slate-800 shadow-sm" : "text-slate-500")}
              >
                Medicine
              </button>
              <button 
                type="button" 
                onClick={() => setPreviewTab('followup')} 
                className={cn("px-2 py-1.5 rounded-lg transition-colors flex-1 truncate text-center", previewTab === 'followup' ? "bg-white dark:bg-slate-800 dark:text-white text-slate-800 shadow-sm" : "text-slate-500")}
              >
                Followup
              </button>
              <button 
                type="button" 
                onClick={() => setPreviewTab('test')} 
                className={cn("px-2 py-1.5 rounded-lg transition-colors flex-1 truncate text-center", previewTab === 'test' ? "bg-white dark:bg-slate-800 dark:text-white text-slate-800 shadow-sm" : "text-slate-500")}
              >
                Test
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 py-2 overflow-y-auto flex flex-col justify-start gap-4">
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl rounded-tl-none max-w-[95%] text-[10px] font-bold shadow-sm text-slate-700 dark:text-slate-200 border-l-4 border-brand-500 relative">
                <span className="block text-brand-500 font-black mb-1">🏥 {clinicName || 'Apollo Health Clinic'}</span>
                
                <p className="whitespace-pre-wrap leading-relaxed font-mono text-[9px]">
                  {getPreviewMessageText()}
                </p>

                {/* Display interactive buttons based on preview selection */}
                {previewTab === 'welcome' && (
                  <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2 flex flex-col gap-1.5">
                    <div className="py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-[9px] font-black text-brand-600 border border-slate-100 dark:border-slate-700">Book</div>
                    <div className="py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-[9px] font-black text-brand-600 border border-slate-100 dark:border-slate-700">My Reminders</div>
                    <div className="py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-[9px] font-black text-brand-600 border border-slate-100 dark:border-slate-700">Help</div>
                  </div>
                )}
                {previewTab === 'medicine' && (
                  <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2 flex gap-2">
                    <div className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-[9px] font-black text-brand-600 border border-slate-100 dark:border-slate-700">Taken ✅</div>
                    <div className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-[9px] font-black text-brand-600 border border-slate-100 dark:border-slate-700">Skip ⏭️</div>
                  </div>
                )}
                {previewTab === 'followup' && (
                  <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2 flex gap-2">
                    <div className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-[9px] font-black text-brand-600 border border-slate-100 dark:border-slate-700">Book Follow-up</div>
                    <div className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-[9px] font-black text-brand-600 border border-slate-100 dark:border-slate-700">Cancel Follow-up</div>
                  </div>
                )}

                <span className="absolute bottom-1 right-2 text-[7px] text-slate-400 font-bold uppercase mt-2 block">10:24 AM ✓✓</span>
              </div>
            </div>

            {/* Phone Keyboard input footer */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-2 -mx-4 -mb-4 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex-1 bg-white dark:bg-slate-900 rounded-full h-8 px-4 flex items-center justify-between shadow-sm">
                <span className="text-[9px] text-slate-350 font-bold">Message...</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#075e54] flex items-center justify-center text-white text-xs font-black">
                ➜
              </div>
            </div>
          </div>
        </div>

      </div>

      <DoctorSettings tier={tier} />
    </div>
  );
}

// Sub-components: ColorOption
function ColorOption({ label, color, active, onClick, custom = false }: { label: string, color?: string, active: boolean, onClick: () => void, custom?: boolean }) {
  return (
    <button 
      type="button" 
      onClick={onClick}
      className={cn(
        "px-3 py-3 rounded-xl border text-left flex items-center gap-3 transition-all relative overflow-hidden active:scale-95",
        active 
          ? "border-brand-500 ring-2 ring-brand-500/20 bg-brand-500/5" 
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
      )}
    >
      {custom ? (
        <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-rose-500 via-emerald-500 to-indigo-500 shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-lg shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-350">{label}</span>
      {active && (
        <div className="absolute top-0 right-0 w-3 h-3 bg-brand-500 rounded-bl-lg flex items-center justify-center text-[7px] text-white font-black font-sans">✓</div>
      )}
    </button>
  );
}

// Sub-components: CheckboxOption
function CheckboxOption({ checked, onChange, title, description }: { checked: boolean, onChange: (val: boolean) => void, title: string, description: string }) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      className={cn(
        "p-4 rounded-2xl border flex items-start gap-3.5 cursor-pointer select-none transition-all duration-300",
        checked 
          ? "border-brand-500 ring-2 ring-brand-500/10 bg-brand-500/5" 
          : "border-slate-150 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-750 bg-white dark:bg-slate-900"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all",
        checked ? "bg-brand-500 border-brand-500 text-white" : "border-slate-300 dark:border-slate-700 bg-transparent"
      )}>
        {checked && <span className="text-[10px] font-black font-sans">✓</span>}
      </div>
      <div>
        <p className="text-xs font-black dark:text-white leading-tight">{title}</p>
        <p className="text-[9px] text-slate-400 mt-1 font-bold leading-normal uppercase">{description}</p>
      </div>
    </div>
  );
}

// Sub-components: PremiumLockOverlay
function PremiumLockOverlay({ title, desc, onUnlock, isUpgrading }: { title: string, desc: string, onUnlock: () => void, isUpgrading: boolean }) {
  return (
    <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/70 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-indigo-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-md">
        <Lock size={18} />
      </div>
      <span className="px-3 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[8px] font-black rounded-full border border-brand-100 dark:border-brand-900/50 uppercase tracking-widest mb-1.5">
        Professional Feature Locked
      </span>
      <h4 className="text-sm font-black dark:text-white tracking-tight leading-tight max-w-[240px]">
        {title}
      </h4>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 max-w-[260px] leading-relaxed mb-4">{desc}</p>
      <button 
        type="button"
        onClick={onUnlock}
        disabled={isUpgrading}
        className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
      >
        {isUpgrading ? <Loader2 className="animate-spin" size={12} /> : 'Upgrade to Professional'}
      </button>
    </div>
  );
}

// Sub-components: EnterpriseLockOverlay
function EnterpriseLockOverlay({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/70 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-md">
        <Lock size={18} />
      </div>
      <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[8px] font-black rounded-full border border-amber-100 dark:border-amber-900/50 uppercase tracking-widest mb-1.5">
        Enterprise Package
      </span>
      <h4 className="text-sm font-black dark:text-white tracking-tight leading-tight max-w-[240px]">
        {title}
      </h4>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 max-w-[260px] leading-relaxed mb-4">{desc}</p>
      <button 
        type="button"
        onClick={() => alert('Please contact our enterprise support team at sales@clinicpro.com to upgrade and configure Custom Domains, API Access, or Multi-Branch systems.')}
        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
      >
        Contact Enterprise Support
      </button>
    </div>
  );
}

// Sub-components: DoctorSettings
function DoctorSettings({ tier }: { tier: string }) {
  const { doctors, loading, addDoctor, updateDoctor, deleteDoctor } = useDoctors();
  const [isAdding, setIsAdding] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experience, setExperience] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save metadata like photo & registration number inside availability_json dynamically
    const baseAvailability = editingDoctor?.availability_json || {
      version: "2.0",
      weekly: {
        monday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
        tuesday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
        wednesday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
        thursday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
        friday: { enabled: true, sessions: [{ start: "09:00 AM", end: "01:00 PM" }] },
        saturday: { enabled: false, sessions: [] },
        sunday: { enabled: false, sessions: [] },
      },
      consultation_duration: 15,
      advanced: {
        max_patients_per_day: 40,
        emergency_buffer: 2,
        blocked_dates: [],
      }
    };

    const updatedAvailability = {
      ...baseAvailability,
      registration_number: regNumber,
      photo_url: photoUrl
    };

    const payload = { 
      name, 
      specialty, 
      qualifications, 
      experience,
      availability_json: updatedAvailability
    };

    if (editingDoctor) {
      await updateDoctor(editingDoctor.id, payload);
      setEditingDoctor(null);
    } else {
      await addDoctor(payload);
      setIsAdding(false);
    }

    setName('');
    setSpecialty('');
    setQualifications('');
    setExperience('');
    setRegNumber('');
    setPhotoUrl('');
  };

  const startEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setName(doc.name);
    setSpecialty(doc.specialty || '');
    setQualifications(doc.qualifications || '');
    setExperience(doc.experience || '');
    
    const meta = doc.availability_json || {};
    setRegNumber(meta.registration_number || '');
    setPhotoUrl(meta.photo_url || '');
    setIsAdding(true);
  };

  // Handle doctor photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200000) {
        alert('Image must be under 200KB. Please compress the doctor photo.');
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        setPhotoUrl(base64);
      } catch (err) {
        console.error(err);
        alert('Failed to read image file.');
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-10">
        <div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight">Doctor Management</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Configure your clinic’s medical staff profiles</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => { 
              setIsAdding(true); 
              setEditingDoctor(null); 
              setName(''); 
              setSpecialty(''); 
              setQualifications(''); 
              setExperience(''); 
              setRegNumber('');
              setPhotoUrl('');
            }}
            className="px-6 py-3 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg flex items-center gap-2 outline-none active:scale-95"
          >
            <UserPlus size={18} aria-hidden="true" /> Add New Doctor
          </button>
        )}
      </div>

      {isAdding && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Header info */}
            <div>
              <h3 className="text-xl font-black dark:text-white">{editingDoctor ? 'Edit Doctor Profile' : 'Add New Medical Staff'}</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Define metadata, specialty, and registration fields</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              
              {/* Left Column: Photo Upload (Premium check visual warning/disabled if Essential) */}
              <div className="space-y-3 flex flex-col items-center sm:items-start text-center sm:text-left relative">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Doctor Avatar</span>
                
                <div className="relative w-36 h-36 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden shadow-inner group">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Doctor avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Stethoscope size={48} className="text-slate-300 dark:text-slate-700" />
                  )}
                </div>
                
                <label className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-850 hover:bg-slate-50 border border-slate-200 dark:border-slate-850 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all",
                  tier !== 'Professional' && "opacity-50 cursor-not-allowed pointer-events-none"
                )}>
                  <Upload size={12} /> Select Photo
                  <input type="file" accept="image/*" className="hidden" disabled={tier !== 'Professional'} onChange={handlePhotoUpload} />
                </label>
                {tier !== 'Professional' && (
                  <span className="text-[8px] bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1">
                    <Lock size={8} /> Pro Feature
                  </span>
                )}
                {photoUrl && tier === 'Professional' && (
                  <button type="button" onClick={() => setPhotoUrl('')} className="text-[9px] font-black text-rose-500 uppercase tracking-wider hover:underline">Remove Avatar</button>
                )}
              </div>

              {/* Right Columns: Forms */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label htmlFor="docName" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Doctor Full Name</label>
                  <input 
                    id="docName"
                    type="text" value={name} onChange={e => setName(e.target.value)} required
                    placeholder="Dr. Prabhat Jain"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20"
                    spellCheck={false}
                  />
                </div>
                
                <div className="space-y-1.5 relative">
                  <label htmlFor="docSpecialty" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer flex items-center justify-between">
                    <span>Specialty</span>
                    {tier !== 'Professional' && <span className="text-[8px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-0.5"><Lock size={8} /> Pro</span>}
                  </label>
                  <input 
                    id="docSpecialty"
                    type="text" value={specialty} onChange={e => setSpecialty(e.target.value)}
                    placeholder="Cardiologist, Dermatologist"
                    disabled={tier !== 'Professional'}
                    className={cn(
                      "w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20",
                      tier !== 'Professional' && "opacity-50 cursor-not-allowed"
                    )}
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-1.5 relative">
                  <label htmlFor="docRegNumber" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer flex items-center justify-between">
                    <span>Medical Registration Number</span>
                    {tier !== 'Professional' && <span className="text-[8px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-0.5"><Lock size={8} /> Pro</span>}
                  </label>
                  <input 
                    id="docRegNumber"
                    type="text" value={regNumber} onChange={e => setRegNumber(e.target.value)}
                    placeholder="e.g. MCI-12345"
                    disabled={tier !== 'Professional'}
                    className={cn(
                      "w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20",
                      tier !== 'Professional' && "opacity-50 cursor-not-allowed"
                    )}
                  />
                </div>

                <div className="space-y-1.5 relative">
                  <label htmlFor="docQualifications" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer flex items-center justify-between">
                    <span>Qualifications & Degrees</span>
                    {tier !== 'Professional' && <span className="text-[8px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-0.5"><Lock size={8} /> Pro</span>}
                  </label>
                  <input 
                    id="docQualifications"
                    type="text" value={qualifications} onChange={e => setQualifications(e.target.value)}
                    placeholder="MBBS, MD"
                    disabled={tier !== 'Professional'}
                    className={cn(
                      "w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20",
                      tier !== 'Professional' && "opacity-50 cursor-not-allowed"
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="docExperience" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-pointer">Professional Experience / Short Biography</label>
              <textarea 
                id="docExperience"
                rows={3} value={experience} onChange={e => setExperience(e.target.value)}
                placeholder="e.g. Over 15 years of experience in leading multi-speciality medical centers."
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold transition-all outline-none dark:text-white focus:ring-2 focus:ring-brand-500/20"
                spellCheck={false}
              />
            </div>

            <div className="bg-brand-50/50 dark:bg-brand-900/10 p-5 rounded-2xl border border-brand-100/50 dark:border-brand-900/30 flex items-center gap-3">
              <ShieldCheck size={18} className="text-brand-500" />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Dynamic availability and consulting slots are managed under the Doctor Availability dashboard.</p>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="submit" className="flex-1 py-4 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg active:scale-95 outline-none">
                {editingDoctor ? 'Update Profile' : 'Add Doctor'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all outline-none">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Doctor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin text-brand-500 mx-auto" size={32} aria-hidden="true" /></div>
        ) : doctors.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 p-20 rounded-[2.5rem] text-center border border-slate-150 dark:border-slate-800 shadow-sm">
            <p className="text-slate-450 font-bold">No doctors registered yet. Add your clinic's first doctor to begin.</p>
          </div>
        ) : (
          doctors.map(doc => {
            const meta = doc.availability_json || {};
            // Hide Doctor Photo and other fields in display card if tier is not Professional
            const docPhoto = tier === 'Professional' ? (meta.photo_url || '') : '';
            const docRegNum = tier === 'Professional' ? (meta.registration_number || '') : '';
            const docSpecialty = tier === 'Professional' ? (doc.specialty || 'General Practitioner') : 'General Practitioner';
            const docQualifications = tier === 'Professional' ? (doc.qualifications || '') : '';

            return (
              <div key={doc.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-sm group hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-brand-500 overflow-hidden shadow-inner shrink-0 relative">
                      {docPhoto ? (
                        <img src={docPhoto} alt="Doctor avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Stethoscope size={28} aria-hidden="true" />
                      )}
                      {tier !== 'Professional' && (
                        <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-950/50 flex items-center justify-center text-slate-400">
                          <Lock size={12} />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(doc)} className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 text-slate-400 hover:text-brand-500 rounded-xl transition-colors outline-none" title="Edit Profile"><Settings size={14} aria-hidden="true" /></button>
                      <button onClick={() => { if(confirm('Delete this doctor?')) deleteDoctor(doc.id); }} className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 rounded-xl transition-colors outline-none" title="Remove Doctor"><AlertCircle size={14} aria-hidden="true" /></button>
                    </div>
                  </div>
                  
                  <h4 className="text-lg font-black dark:text-white">{doc.name}</h4>
                  <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mt-0.5 mb-2">{docSpecialty}</p>
                  
                  {docRegNum && (
                    <p className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md w-fit border border-slate-200/50 dark:border-slate-700/50 uppercase tracking-wider mb-3">
                      Reg: {docRegNum}
                    </p>
                  )}
                  
                  {docQualifications && (
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">
                      {docQualifications}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span className="flex items-center gap-1.5"><Clock size={12} /> Schedule</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md",
                    meta.version === "2.0" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  )}>
                    {meta.version === "2.0" ? 'Configured' : 'Legacy'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
