import { 
  AreaChart, 
  Area, 
  ResponsiveContainer 
} from 'recharts';

const busiestHoursData = [
  { name: '9am', value: 40 },
  { name: '10am', value: 30 },
  { name: '11am', value: 65 },
  { name: '12pm', value: 45 },
  { name: '1pm', value: 20 },
  { name: '2pm', value: 55 },
  { name: '3pm', value: 75 },
  { name: '4pm', value: 40 },
];

export function AnalyticsView() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl">
           <h3 className="text-xl font-black dark:text-white mb-6">Patient Traffic</h3>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={busiestHoursData}>
                  <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill="#0ea5e920" strokeWidth={4} />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-center">
           <div className="space-y-8">
              <div className="flex items-center justify-between">
                 <span className="text-sm font-bold text-slate-500">Average Consultation Time</span>
                 <span className="text-lg font-black dark:text-white">12.5 mins</span>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-sm font-bold text-slate-500">New Patients Today</span>
                 <span className="text-lg font-black dark:text-white">8</span>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-sm font-bold text-slate-500">Cancellation Rate</span>
                 <span className="text-lg font-black dark:text-rose-500">2.1%</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
