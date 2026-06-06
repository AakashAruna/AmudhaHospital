import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  CalendarClock, 
  Wallet, 
  PiggyBank, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const Dashboard = () => {
  const { apiFetch } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [incomeDateFilter, setIncomeDateFilter] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, cRes] = await Promise.all([
        apiFetch('http://localhost:8000/api/payments/dashboard-metrics'),
        apiFetch('http://localhost:8000/api/payments/charts/daily-collections')
      ]);
      setMetrics(mRes);
      setChartData(cRes);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Stock Value',
      value: `₹${(metrics?.total_stock_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Package,
      color: 'text-blue-500 bg-blue-50 border-blue-100',
      description: 'Asset value of physical inventory'
    },
    {
      label: 'Low Stock Items',
      value: metrics?.low_stock_count ?? 0,
      icon: AlertTriangle,
      color: (metrics?.low_stock_count ?? 0) > 0 ? 'text-red-500 bg-red-50 border-red-100 animate-pulse' : 'text-slate-500 bg-slate-50 border-slate-100',
      description: 'Below safe reorder levels'
    },
    {
      label: 'Expiring in 30 Days',
      value: metrics?.expiring_soon_count ?? 0,
      icon: CalendarClock,
      color: (metrics?.expiring_soon_count ?? 0) > 0 ? 'text-amber-500 bg-amber-50 border-amber-100' : 'text-slate-500 bg-slate-50 border-slate-100',
      description: 'Immediate action needed'
    },
    {
      label: 'Outstanding Receivables',
      value: `₹${(metrics?.total_receivables ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Wallet,
      color: 'text-purple-500 bg-purple-50 border-purple-100',
      description: 'Patient/Insurance balance due'
    },
    {
      label: 'Total Collections',
      value: `₹${(metrics?.total_collections ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: PiggyBank,
      color: 'text-emerald-500 bg-emerald-50 border-emerald-100',
      description: 'Total revenue collected to date'
    }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hospital Analytics Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time status of inventory assets and financial logs.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 text-sm font-semibold bg-white border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-50 text-slate-700 shadow-sm transition active:scale-95"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchDashboardData} className="underline font-semibold hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{card.label}</span>
                  <p className="text-2xl font-bold text-slate-950 mt-1">{card.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-400 text-[11px] mt-4 font-medium">{card.description}</p>
            </div>
          );
        })}
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collection Area Chart */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">Collections Revenue Trend</h3>
              <p className="text-slate-400 text-xs mt-0.5">Summary of daily checkout payments received.</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Revenue Active</span>
            </div>
          </div>
          
          <div className="h-[350px] w-full relative">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(tick) => tick.substring(5)} 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: 'white' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px' }}
                    formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Collected']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No transaction logs recorded in the past 30 days.
              </div>
            )}
          </div>
        </div>
        {/* Daywise Income Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col h-full min-h-[380px]">
          <div className="flex flex-col h-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Daywise Income</h3>
                <p className="text-slate-400 text-xs mt-0.5">Daily breakdown of payment collections.</p>
              </div>
              
              {/* Date Selector */}
              <div className="flex items-center gap-1.5 no-print">
                <input
                  type="date"
                  value={incomeDateFilter}
                  onChange={(e) => setIncomeDateFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer bg-slate-50 hover:bg-slate-100/60 font-semibold"
                />
                {incomeDateFilter && (
                  <button
                    onClick={() => setIncomeDateFilter('')}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                    title="Clear filter"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0 custom-scrollbar">
              {(() => {
                const displayData = (() => {
                  if (!incomeDateFilter) {
                    return [...chartData]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 5);
                  }
                  
                  const match = chartData.find(item => item.date === incomeDateFilter);
                  if (match) {
                    return [match];
                  } else {
                    return [{ date: incomeDateFilter, amount: 0 }];
                  }
                })();

                if (displayData.length > 0) {
                  return displayData.map((item, idx) => {
                    let formattedDate = item.date;
                    try {
                      const dateObj = new Date(item.date);
                      if (!isNaN(dateObj.getTime())) {
                        formattedDate = dateObj.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        });
                      }
                    } catch (e) {
                      // fallback
                    }

                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/80 transition duration-150 group animate-fadeIn"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-50 text-slate-500 border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition duration-150">
                            <CalendarClock className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-slate-700 text-xs font-semibold block">{formattedDate}</span>
                            <span className="text-slate-400 text-[10px]">Collection Day</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`${item.amount > 0 ? 'text-emerald-600 font-bold' : 'text-slate-500 font-semibold'} text-sm block`}>
                            ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-slate-400 text-[9px] uppercase tracking-wider font-semibold">Received</span>
                        </div>
                      </div>
                    );
                  });
                }

                return (
                  <div className="flex flex-col items-center justify-center h-full py-10 text-slate-400 text-xs space-y-2">
                    <CalendarClock className="w-8 h-8 text-slate-300" />
                    <span>No collections recorded.</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
