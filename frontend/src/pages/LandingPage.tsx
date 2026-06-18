import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  MessageSquare, 
  LayoutDashboard,
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Users, 
  Activity,
  Play,
  Star,
  Globe,
  Stethoscope,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';
import { cn } from '../lib/utils';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-slate-900 dark:text-slate-50 transition-colors duration-500 font-sans selection:bg-brand-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-500/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/60 dark:bg-[#020617]/60 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-2 group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 group-hover:scale-110 transition-transform">
              <Stethoscope size={22} strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">ClinicPRO</span>
          </Link>
          
          <div className="hidden lg:flex items-center gap-10">
            {['Features', 'Solutions', 'Pricing', 'Resources'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-bold text-slate-500 hover:text-brand-500 dark:text-slate-400 dark:hover:text-white transition-colors relative group/link">
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-500 transition-all duration-300 group-hover/link:w-full" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <Link to="/login" className="hidden sm:block text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-brand-500 transition-colors">Log in</Link>
            <Link to="/signup" className="px-6 py-2.5 bg-brand-500 text-white text-sm font-black rounded-2xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 active:scale-95">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-48 pb-32 px-8 relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 text-[10px] font-black tracking-[0.2em] mb-8 border border-brand-100 dark:border-brand-900/50 shadow-sm">
              <Zap size={14} fill="currentColor" className="animate-pulse" />
              <span>THE FUTURE OF CLINIC WORKFLOW</span>
            </div>
            <h1 className="text-6xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-8 dark:text-white">
              The Ultimate <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-500">WhatsApp-Powered</span> OS.
            </h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 mb-12 leading-relaxed max-w-xl font-medium">
              Reduce receptionist workload by 80%, eliminate missed appointments, and boost patient compliance via the app they already love.
            </p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Link to="/signup" className="px-10 py-5 bg-brand-500 text-white font-black rounded-[1.25rem] hover:bg-brand-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-500/25 group active:scale-95">
                Get Started Free <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="px-10 py-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black rounded-[1.25rem] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-800 shadow-sm active:scale-95 group">
                <Play size={20} fill="currentColor" className="text-brand-500 group-hover:scale-110 transition-transform" /> Watch Demo
              </button>
            </div>
            <div className="mt-12 flex items-center gap-8 text-slate-400">
               <div className="flex items-center gap-2 group cursor-help">
                 <ShieldCheck size={20} className="group-hover:text-emerald-500 transition-colors" />
                 <span className="text-[10px] font-black uppercase tracking-widest">HIPAA Certified</span>
               </div>
               <div className="flex items-center gap-2 group cursor-help">
                 <Star size={20} className="group-hover:text-amber-500 transition-colors" />
                 <span className="text-[10px] font-black uppercase tracking-widest">4.9/5 User Rating</span>
               </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotateY: 20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative perspective-1000"
          >
            {/* Split-screen Mockup */}
            <div className="relative z-10 grid grid-cols-12 gap-6 items-center">
              {/* WhatsApp Mockup */}
              <div className="col-span-5 pt-20">
                <div className="bg-slate-950 rounded-[3rem] p-3 shadow-2xl border-[6px] border-slate-800 aspect-[9/19.5] relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                  <div className="bg-[#075e54] h-14 flex items-center px-4 gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 p-0.5"><div className="w-full h-full rounded-full bg-brand-500" /></div>
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-white">City Clinic Bot</p>
                      <p className="text-[9px] text-emerald-100 font-bold">online</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4 bg-[#e5ddd5] h-full overflow-hidden">
                    <motion.div initial={{x:-20, opacity:0}} animate={{x:0, opacity:1}} transition={{delay:0.5}} className="bg-white p-3 rounded-2xl rounded-tl-none max-w-[85%] text-[10px] font-bold shadow-sm text-slate-700">
                      Hello! Welcome to City Clinic. How can I help you today?
                    </motion.div>
                    <motion.div initial={{x:20, opacity:0}} animate={{x:0, opacity:1}} transition={{delay:1}} className="bg-[#dcf8c6] p-3 rounded-2xl rounded-tr-none ml-auto max-w-[85%] text-[10px] font-bold shadow-sm text-slate-800">
                      I want to book an appointment with Dr. House.
                    </motion.div>
                    <motion.div initial={{x:-20, opacity:0}} animate={{x:0, opacity:1}} transition={{delay:1.5}} className="bg-white p-3 rounded-2xl rounded-tl-none max-w-[90%] text-[10px] font-bold shadow-sm text-slate-700 border-l-4 border-brand-500">
                      Sure! Dr. House has a slot at 3:30 PM today. Reply 'CONFIRM' to book.
                    </motion.div>
                  </div>
                </div>
              </div>
              
              {/* Dashboard Mockup */}
              <div className="col-span-7">
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200/50 dark:border-slate-800 overflow-hidden aspect-[4/3] group hover:scale-[1.02] transition-transform duration-500">
                  <div className="h-10 border-b border-slate-100 dark:border-slate-800 flex items-center px-5 gap-2 bg-slate-50/50 dark:bg-slate-950/50">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-8">
                       <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded-full" />
                       <div className="h-8 w-8 bg-brand-500 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="h-24 bg-brand-500 rounded-3xl p-4 flex flex-col justify-end">
                         <div className="h-2 w-12 bg-white/30 rounded-full mb-2" />
                         <div className="h-4 w-20 bg-white rounded-full" />
                      </div>
                      <div className="h-24 bg-slate-50 dark:bg-slate-800 rounded-3xl p-4 flex flex-col justify-end">
                         <div className="h-2 w-12 bg-slate-200 dark:bg-slate-700 rounded-full mb-2" />
                         <div className="h-4 w-20 bg-slate-300 dark:bg-slate-600 rounded-full" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl w-full flex items-center px-4 gap-3">
                         <div className="h-2 w-2 bg-brand-500 rounded-full" />
                         <div className="h-2 w-32 bg-slate-200 dark:bg-slate-700 rounded-full" />
                      </div>
                      <div className="h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl w-full flex items-center px-4 gap-3">
                         <div className="h-2 w-2 bg-slate-200 dark:bg-slate-700 rounded-full" />
                         <div className="h-2 w-48 bg-slate-200 dark:bg-slate-700 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Background Decorative Element */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-brand-500/10 blur-[150px] rounded-full -z-0 animate-pulse" />
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 border-y border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <StatCard icon={<Zap className="text-amber-500" />} title="Workload Reduction" metric="80%" subtitle="Automated inquiries" />
            <StatCard icon={<Clock className="text-brand-500" />} title="Wait Time Saved" metric="15m" subtitle="Per appointment" />
            <StatCard icon={<Activity className="text-emerald-500" />} title="Staff Efficiency" metric="2x" subtitle="Throughput boost" />
            <StatCard icon={<Users className="text-blue-500" />} title="Patient Satisfaction" metric="4.9" subtitle="Average rating" />
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section id="features" className="py-40 space-y-52 px-8">
        <FeatureItem 
          title="Conversational Booking"
          description="Patients view available slots and book instantly on WhatsApp. No app to download, no website to navigate. Pure convenience."
          image={<img src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=1200" className="rounded-[2.5rem] shadow-2xl group-hover:scale-105 transition-transform duration-700" alt="Booking" />}
          tags={['Real-time', 'WhatsApp API', 'Auto-Sync']}
          icon={<MessageSquare className="text-brand-500" />}
        />
        <FeatureItem 
          reversed
          title="Digital Queue Board"
          description="A live-updating queue dashboard for your reception. Call patients, skip no-shows, and manage emergencies with one tap."
          image={<img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=1200" className="rounded-[2.5rem] shadow-2xl group-hover:scale-105 transition-transform duration-700" alt="Queue" />}
          tags={['Reception Panel', 'Live Status', 'Prioritization']}
          icon={<LayoutDashboard className="text-emerald-500" />}
        />
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-40 relative bg-[#f8fafc] dark:bg-slate-900/50 border-y border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
           <div className="absolute top-20 left-20 w-96 h-96 bg-brand-500 rounded-full blur-[100px]" />
           <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-500 rounded-full blur-[100px]" />
        </div>
        <div className="max-w-7xl mx-auto px-8 relative">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-5xl font-black mb-6 tracking-tight dark:text-white leading-tight">Scale your practice with ClinicPRO.</h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">Simple, transparent pricing that grows with you.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto items-center">
            <PricingCard tier="Essential" price="$49" features={['WhatsApp Booking', 'Live Queue Board', 'Basic Analytics', 'Email Support']} />
            <PricingCard tier="Professional" price="$99" features={['Everything in Essential', 'Medication Reminders', 'Full Compliance API', 'Priority Support', 'Custom Branding']} highlighted />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-32 border-t border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-950 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-16 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-8 group cursor-pointer">
                <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 group-hover:rotate-12 transition-transform">
                  <Stethoscope size={22} strokeWidth={2.5} />
                </div>
                <span className="text-2xl font-black tracking-tighter dark:text-white">ClinicPRO</span>
              </div>
              <p className="text-lg text-slate-500 dark:text-slate-400 max-w-sm font-medium leading-relaxed">The operating system for modern clinics. Built for efficiency, designed for patients.</p>
              <div className="mt-8 flex gap-4">
                 {[Globe, Activity, MessageSquare].map((Icon, i) => (
                   <div key={i} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-brand-500 cursor-pointer transition-colors border border-slate-200 dark:border-slate-800">
                     <Icon size={20} />
                   </div>
                 ))}
              </div>
            </div>
            <div>
              <h5 className="font-black uppercase tracking-widest text-[11px] text-slate-400 mb-8">Platform</h5>
              <ul className="space-y-5 text-sm font-bold text-slate-500 dark:text-slate-400">
                {['Queue Management', 'Reminders', 'WhatsApp Bot', 'Analytics'].map(item => (
                  <li key={item} className="hover:text-brand-500 cursor-pointer transition-colors">{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="font-black uppercase tracking-widest text-[11px] text-slate-400 mb-8">Company</h5>
              <ul className="space-y-5 text-sm font-bold text-slate-500 dark:text-slate-400">
                {['About Us', 'Success Stories', 'Privacy Policy', 'Contact'].map(item => (
                  <li key={item} className="hover:text-brand-500 cursor-pointer transition-colors">{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-10 border-t border-slate-100 dark:border-slate-900 flex flex-col md:row items-center justify-between gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <p>© 2026 ClinicPRO Technologies. All rights reserved.</p>
            <div className="flex gap-8 items-center">
              <span>System Status: <span className="text-emerald-500">Normal</span></span>
              <span>Uptime: 99.9%</span>
              <Link 
                to="/login"
                className="opacity-20 hover:opacity-100 transition-opacity text-slate-500 dark:text-slate-400 cursor-pointer text-xs ml-1"
                title="System Admin Portal"
              >
                🔑
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon, title, subtitle, metric }: { icon: React.ReactNode, title: string, subtitle: string, metric: string }) {
  return (
    <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/50 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all duration-500 group group hover:-translate-y-2">
      <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-12 group-hover:bg-brand-50 transition-all duration-500">
        {icon}
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      <h3 className="text-4xl font-black mb-1 dark:text-white tracking-tight">{metric}</h3>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{subtitle}</p>
    </div>
  );
}

function FeatureItem({ title, description, image, tags, reversed = false, icon }: { title: string, description: string, image: React.ReactNode, tags: string[], reversed?: boolean, icon: React.ReactNode }) {
  return (
    <div className={cn("max-w-7xl mx-auto flex flex-col lg:flex-row gap-24 items-center group", reversed && "lg:flex-row-reverse")}>
      <div className="flex-1">
        <div className="flex gap-2 mb-8">
          {tags.map(tag => (
            <span key={tag} className="px-4 py-1.5 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[10px] font-black rounded-full border border-brand-100 dark:border-brand-900/50 uppercase tracking-widest shadow-sm">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-4 mb-6">
           <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
             {icon}
           </div>
           <h2 className="text-5xl font-black tracking-tight leading-tight dark:text-white">{title}</h2>
        </div>
        <p className="text-xl text-slate-500 dark:text-slate-400 mb-10 leading-relaxed font-medium">{description}</p>
        <button className="flex items-center gap-3 font-black text-brand-600 dark:text-brand-400 hover:gap-6 transition-all group/btn uppercase text-xs tracking-widest">
          Discover How it Works <ChevronRight size={18} className="group-hover/btn:scale-110" />
        </button>
      </div>
      <div className="flex-1 relative">
        <div className="relative z-10 overflow-hidden rounded-[3rem] shadow-2xl border border-slate-200/50 dark:border-slate-800">
           {image}
        </div>
        <div className="absolute -inset-10 bg-gradient-to-br from-brand-500/10 to-emerald-500/10 blur-[80px] -z-10 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

function PricingCard({ tier, price, features, highlighted = false }: { tier: string, price: string, features: string[], highlighted?: boolean }) {
  return (
    <div className={cn(
      "p-12 rounded-[3.5rem] border transition-all duration-700 relative overflow-hidden group hover:-translate-y-4",
      highlighted 
        ? "bg-gradient-to-br from-brand-600 to-brand-700 border-brand-500 text-white shadow-2xl shadow-brand-500/30 scale-105 z-10" 
        : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-none"
    )}>
      {highlighted && (
        <div className="absolute top-10 right-10 px-4 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md">
          Most Popular
        </div>
      )}
      <p className={cn("text-[10px] font-black uppercase tracking-[0.3em] mb-6", highlighted ? "text-brand-100" : "text-slate-400")}>{tier}</p>
      <div className="flex items-baseline gap-2 mb-10">
        <span className="text-6xl font-black tracking-tighter">{price}</span>
        <span className={cn("text-sm font-black uppercase tracking-widest opacity-60", highlighted ? "text-brand-100" : "text-slate-400")}>{price !== 'Custom' && '/mo'}</span>
      </div>
      <ul className="space-y-6 mb-12">
        {features.map(f => (
          <li key={f} className="flex items-center gap-4 text-sm font-bold tracking-tight">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shadow-sm", highlighted ? "bg-white/20" : "bg-brand-50 dark:bg-brand-900/30")}>
              <CheckCircle2 size={14} className={highlighted ? "text-white" : "text-brand-500"} />
            </div>
            {f}
          </li>
        ))}
      </ul>
      <Link to="/signup" className={cn(
        "w-full py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center shadow-lg active:scale-95",
        highlighted 
          ? "bg-white text-brand-600 hover:bg-slate-50 shadow-white/10" 
          : "bg-brand-500 text-white hover:bg-brand-600 shadow-brand-500/20"
      )}>
        Select {tier}
      </Link>
    </div>
  );
}
