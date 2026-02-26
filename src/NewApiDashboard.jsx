import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import dayjs from 'dayjs';

const IconRefresh = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const IconCalendar = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const IconTrendingUp = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const IconUsers = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconDollarSign = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconCpu = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="16" height="16" x="4" y="4" rx="2" />
    <rect width="6" height="6" x="9" y="9" rx="1" />
    <path d="M15 2v2" />
    <path d="M15 20v2" />
    <path d="M2 15h2" />
    <path d="M2 9h2" />
    <path d="M20 15h2" />
    <path d="M20 9h2" />
    <path d="M9 2v2" />
    <path d="M9 20v2" />
  </svg>
);

const IconActivity = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const IconChevronLeft = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const IconChevronRight = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const IconTrophy = ({ className, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={color || "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const IconArrowLeft = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const formatCost = (val) => {
  if (val === undefined || val === null) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
};

const formatTokens = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatNumber = (num) => {
  if (!num) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

const StatCard = ({ title, value, subValue, icon: Icon, colorClass = "text-cyan-400" }) => (
  <div className="group relative overflow-hidden rounded-xl bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 p-6 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]">
    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative z-10 flex items-start justify-between">
      <div>
        <p className={`text-sm font-medium uppercase tracking-wider ${colorClass}`}>{title}</p>
        <h3 className="mt-2 text-3xl font-bold text-white font-mono tabular-nums tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
          {value}
        </h3>
        {subValue && (
          <p className="mt-1 text-xs text-gray-400 font-mono">
            {subValue}
          </p>
        )}
      </div>
      <div className="p-3 rounded-lg bg-gray-800/50 border border-white/5">
        <Icon className={`w-6 h-6 ${colorClass}`} />
      </div>
    </div>
  </div>
);

const LeaderboardRow = ({ rank, name, value, maxValue, type, onClick }) => {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  
  let rankColor = "text-gray-400";
  let medal = null;
  
  if (rank === 1) {
    rankColor = "text-yellow-400";
    medal = <IconTrophy className="w-4 h-4 text-yellow-400 mr-1" color="currentColor" />;
  } else if (rank === 2) {
    rankColor = "text-gray-300";
    medal = <IconTrophy className="w-4 h-4 text-gray-300 mr-1" color="currentColor" />;
  } else if (rank === 3) {
    rankColor = "text-amber-600";
    medal = <IconTrophy className="w-4 h-4 text-amber-600 mr-1" color="currentColor" />;
  }

  const formatValue = (val) => {
    if (type === 'quota') return formatCost(val);
    if (type === 'tokens') return formatTokens(val);
    return formatNumber(val);
  };

  return (
    <div 
      onClick={onClick}
      className="group flex items-center py-3 px-4 hover:bg-cyan-900/10 transition-colors border-b border-gray-800/50 last:border-0 cursor-pointer"
    >
      <div className={`w-12 flex items-center justify-center font-mono font-bold ${rankColor}`}>
        {medal || `#${rank}`}
      </div>
      <div className="flex-1 min-w-0 px-4">
        <div className="flex justify-between items-end mb-1">
          <span className="text-sm font-medium text-gray-200 truncate group-hover:text-cyan-400 transition-colors">{name}</span>
          <span className="text-sm font-mono text-cyan-300">{formatValue(value)}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-1000 ease-out group-hover:shadow-[0_0_10px_rgba(6,182,212,0.5)]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/90 backdrop-blur-md border border-cyan-500/30 p-3 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        <p className="text-cyan-400 font-mono text-sm mb-2 border-b border-gray-700 pb-1">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs font-mono text-gray-200 my-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}:</span>
            <span className="font-bold text-white">
              {entry.name.includes('金额') || entry.name.includes('Cost')
                ? formatCost(entry.value) 
                : entry.name.includes('Token') 
                  ? formatTokens(entry.value)
                  : formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const TokenDetailView = ({ tokenName, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ totalCostCNY: 0, totalTokens: 0, totalRequests: 0, totalPromptTokens: 0, totalCompletionTokens: 0 });
  const [trend, setTrend] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [dailyOv, setDailyOv] = useState({ totalCostCNY: 0, totalTokens: 0, totalRequests: 0, totalPromptTokens: 0, totalCompletionTokens: 0, models: [] });
  const [hourlyData, setHourlyData] = useState({ chartData: [], topModels: [] });

  const enc = encodeURIComponent(tokenName);

  const fetchGlobal = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, trendRes] = await Promise.all([
        fetch(`/api/newapi/user-overview?token_name=${enc}`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/newapi/user-trend?token_name=${enc}`).then(r => r.json()).catch(() => [])
      ]);
      setOverview(ovRes);
      setTrend(trendRes || []);
    } catch (err) {
      console.error("Failed to fetch token data", err);
    } finally {
      setLoading(false);
    }
  }, [tokenName]);

  const fetchDaily = useCallback(async () => {
    try {
      const [dailyRes, hourlyRes] = await Promise.all([
        fetch(`/api/newapi/user-daily-overview?token_name=${enc}&date=${selectedDate}`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/newapi/user-hourly?token_name=${enc}&date=${selectedDate}`).then(r => r.json()).catch(() => ({ chartData: [], topModels: [] }))
      ]);
      setDailyOv(dailyRes);
      setHourlyData(hourlyRes);
    } catch (err) {
      console.error("Failed to fetch daily data", err);
    }
  }, [tokenName, selectedDate]);

  useEffect(() => { fetchGlobal(); }, [fetchGlobal]);
  useEffect(() => { fetchDaily(); }, [fetchDaily]);

  const handlePrevDate = () => setSelectedDate(d => dayjs(d).subtract(1, 'day').format('YYYY-MM-DD'));
  const handleNextDate = () => {
    setSelectedDate(d => {
      const next = dayjs(d).add(1, 'day');
      return next.isAfter(dayjs(), 'day') ? d : next.format('YYYY-MM-DD');
    });
  };

  const dateLabel = selectedDate === dayjs().format('YYYY-MM-DD') ? '今日' : selectedDate;

  const chartData = useMemo(() => {
    if (!trend) return [];
    return trend.map(d => ({ ...d, date: dayjs(d.date).format('MM-DD'), cost: d.totalCostCNY || 0 }));
  }, [trend]);

  const modelAgg = useMemo(() => {
    if (!trend) return [];
    const models = {};
    trend.forEach(day => {
      if (day.models) {
        day.models.forEach(m => {
          if (!models[m.modelName]) models[m.modelName] = 0;
          models[m.modelName] += m.costCNY;
        });
      }
    });
    return Object.entries(models)
      .map(([name, val]) => ({ name, value: val }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [trend]);

  const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

  if (loading && !overview.totalRequests) return <div className="flex justify-center py-20"><IconRefresh className="animate-spin w-8 h-8 text-cyan-500" /></div>;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-lg transition-colors group">
          <IconArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-white" />
        </button>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          令牌详情: <span className="text-cyan-400 font-mono">{tokenName}</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="总消耗金额" value={formatCost(overview.totalCostCNY)} subValue={`${dateLabel}: ${formatCost(dailyOv.totalCostCNY)}`} icon={IconDollarSign} colorClass="text-emerald-400" />
        <StatCard title="总 Token 消耗" value={formatTokens(overview.totalTokens)} subValue={`${dateLabel}: ${formatTokens(dailyOv.totalTokens)}`} icon={IconCpu} colorClass="text-purple-400" />
        <StatCard title="总调用次数" value={formatNumber(overview.totalRequests)} subValue={`${dateLabel}: ${formatNumber(dailyOv.totalRequests)}`} icon={IconActivity} colorClass="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
          <h3 className="text-lg font-bold text-white mb-6">消耗趋势 (全量)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCostDetail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" stroke="#4b5563" tick={{fill: '#9ca3af', fontSize: 10}} axisLine={false} tickLine={false} />
              <YAxis stroke="#4b5563" tick={{fill: '#9ca3af', fontSize: 10}} axisLine={false} tickLine={false} tickFormatter={val => `¥${val}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="cost" name="消耗金额" stroke="#06b6d4" fill="url(#colorCostDetail)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:col-span-1 bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
          <h3 className="text-lg font-bold text-white mb-4">模型消耗占比 (全量)</h3>
          <div className="flex flex-col gap-3">
            <div className="h-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modelAgg} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {modelAgg.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatCost(val)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <span className="text-lg font-bold text-white">{modelAgg.length}</span>
                  <p className="text-[10px] text-cyan-500 font-mono tracking-widest uppercase">Models</p>
                </div>
              </div>
            </div>
            <div className="overflow-y-auto custom-scrollbar pr-1 space-y-1 max-h-[120px]">
              {modelAgg.map((entry, idx) => {
                const total = modelAgg.reduce((s, e) => s + e.value, 0);
                return (
                  <div key={idx} className="flex justify-between items-center text-xs p-1.5 rounded hover:bg-gray-800/50">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-gray-300 truncate font-mono" title={entry.name}>{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-gray-400 font-mono">{formatCost(entry.value)}</span>
                      <span className="text-gray-500 font-mono w-12 text-right">{total > 0 ? (entry.value / total * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl px-5 py-3 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2">
          <IconCalendar className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-medium text-gray-400">每日详情</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-800/80 rounded-lg px-3 py-1.5 border border-gray-700">
          <button onClick={handlePrevDate} className="p-1 hover:text-cyan-400 transition-colors">
            <IconChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-sm font-medium text-white min-w-[120px] text-center">{dateLabel}</span>
          <button onClick={handleNextDate} className="p-1 hover:text-cyan-400 transition-colors disabled:opacity-30" disabled={selectedDate === dayjs().format('YYYY-MM-DD')}>
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
          <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">
            Token 消耗分布 (按小时)
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={hourlyData.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="hour" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }} />
              <YAxis stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }} tickFormatter={val => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  const filtered = payload.filter(item => item.value > 0);
                  if (filtered.length === 0) return null;
                  const total = filtered.reduce((sum, item) => sum + item.value, 0);
                  return (
                    <div className="bg-gray-900/95 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-lg shadow-2xl max-w-xs">
                      <p className="text-cyan-400 font-mono text-sm font-bold mb-2 border-b border-gray-700 pb-2">{label}</p>
                      {filtered.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-300 font-mono">{entry.name}</span>
                          </div>
                          <span className="text-white font-mono">{formatTokens(entry.value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-700 font-bold">
                        <span className="text-gray-400">合计</span>
                        <span className="text-cyan-400 font-mono">{formatTokens(total)}</span>
                      </div>
                    </div>
                  );
                }}
              />
              {hourlyData.topModels.map((model, idx) => (
                <Bar key={model} dataKey={model} stackId="a" fill={COLORS[idx % COLORS.length]} name={model} animationDuration={800} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:col-span-1 bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 shadow-[0_0_15px_rgba(0,0,0,0.3)] flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <IconActivity className="w-5 h-5 text-emerald-400" />
            {dateLabel === '今日' ? '今日概览' : `${dateLabel} 概览`}
          </h3>
          <div className="flex flex-col gap-3">
            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50 flex justify-between items-center">
              <span className="text-xs text-gray-400 uppercase">消耗金额</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">{formatCost(dailyOv.totalCostCNY)}</span>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50 flex justify-between items-center">
              <span className="text-xs text-gray-400 uppercase">调用次数</span>
              <span className="text-lg font-bold text-cyan-400 font-mono">{formatNumber(dailyOv.totalRequests)}</span>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 uppercase">Prompt</p>
                <div className="w-14 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${dailyOv.totalTokens > 0 ? (dailyOv.totalPromptTokens / dailyOv.totalTokens) * 100 : 0}%` }} />
                </div>
              </div>
              <span className="text-base font-bold text-amber-400 font-mono">{formatTokens(dailyOv.totalPromptTokens)}</span>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 uppercase">Completion</p>
                <div className="w-14 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-purple-500" style={{ width: `${dailyOv.totalTokens > 0 ? (dailyOv.totalCompletionTokens / dailyOv.totalTokens) * 100 : 0}%` }} />
                </div>
              </div>
              <span className="text-base font-bold text-purple-400 font-mono">{formatTokens(dailyOv.totalCompletionTokens)}</span>
            </div>
            {dailyOv.models && dailyOv.models.length > 0 && (
              <div className="mt-1">
                <p className="text-xs text-gray-500 uppercase mb-2">模型明细</p>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                  {dailyOv.models.map((m, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="text-gray-300 font-mono truncate max-w-[140px]" title={m.modelName}>{m.modelName}</span>
                      <span className="text-gray-400 font-mono flex-shrink-0">{formatCost(m.costCNY)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ModelAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [topModels, setTopModels] = useState([]);
  
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD')
  });
  const [granularity, setGranularity] = useState('day');
  const [activeIdx, setActiveIdx] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/newapi/model-trend?start=${dateRange.start}&end=${dateRange.end}&granularity=${granularity}`
      );
      const data = await res.json();
      setChartData(data.chartData || []);
      setPieData(data.pieData || []);
      setTopModels(data.topModels || []);
    } catch (err) {
      console.error('Failed to fetch model trend:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartChange = (e) => {
    const newStart = e.target.value;
    if (dayjs(newStart).isBefore(dayjs(dateRange.end))) {
      setDateRange(prev => ({ ...prev, start: newStart }));
    }
  };

  const handleEndChange = (e) => {
    const newEnd = e.target.value;
    if (dayjs(newEnd).isAfter(dayjs(dateRange.start))) {
      setDateRange(prev => ({ ...prev, end: newEnd }));
    }
  };

  const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const filtered = payload.filter(item => item.value > 0);
      if (filtered.length === 0) return null;
      const total = filtered.reduce((sum, item) => sum + item.value, 0);
      return (
        <div className="bg-gray-900/95 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-lg shadow-2xl max-w-xs">
          <p className="text-cyan-400 font-mono text-sm font-bold mb-2 border-b border-gray-700 pb-2">{label}</p>
          {filtered.map((entry, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-300 font-mono">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono">{formatTokens(entry.value)}</span>
                <span className="text-gray-500 font-mono w-12 text-right">
                  {total > 0 ? (entry.value / total * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-700 font-bold">
            <span className="text-gray-400">合计</span>
            <span className="text-cyan-400 font-mono">{formatTokens(total)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading && chartData.length === 0) {
    return (
      <div className="bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 shadow-[0_0_15px_rgba(0,0,0,0.3)] xl:col-span-3 h-[500px] flex items-center justify-center">
        <IconRefresh className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 shadow-[0_0_15px_rgba(0,0,0,0.3)] xl:col-span-3">
      <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <IconCpu className="w-6 h-6 text-cyan-400" />
            模型分布分析
          </h2>
          <p className="text-xs text-gray-500 font-mono mt-1">MODEL DISTRIBUTION ANALYTICS</p>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-1">
            <input
              type="date"
              value={dateRange.start}
              onChange={handleStartChange}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono"
            />
            <span className="text-gray-500 text-xs">至</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={handleEndChange}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>
          
          <div className="flex bg-gray-800 rounded-lg p-1">
            {[
              { id: 'hour', label: '小时' },
              { id: 'day', label: '天' },
              { id: 'week', label: '周' },
              { id: 'month', label: '月' }
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setGranularity(btn.id)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  granularity === btn.id 
                    ? 'bg-cyan-500 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          
          <button 
            onClick={fetchData}
            className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all"
          >
            <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[400px]">
          <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">
            Token 消耗分布 ({granularity === 'hour' ? '按小时' : granularity === 'day' ? '按天' : granularity === 'week' ? '按周' : '按月'})
          </h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart 
              data={chartData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis 
                dataKey="bucket" 
                stroke="#4b5563" 
                tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                stroke="#4b5563" 
                tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={val => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              {topModels.map((model, idx) => (
                <Bar 
                  key={model} 
                  dataKey={model} 
                  stackId="a" 
                  fill={COLORS[idx % COLORS.length]} 
                  name={model}
                  animationDuration={1000}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-[400px] flex flex-col">
          <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">调用次数占比</h3>
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="w-1/2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    onMouseEnter={(_, idx) => setActiveIdx(idx)}
                    onMouseLeave={() => setActiveIdx(null)}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell 
                        key={`cell-${idx}`}
                        fill={COLORS[idx % COLORS.length]}
                        stroke={activeIdx === idx ? '#fff' : 'none'}
                        strokeWidth={2}
                        opacity={activeIdx !== null && activeIdx !== idx ? 0.4 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        const total = pieData.reduce((sum, item) => sum + item.value, 0);
                        return (
                          <div className="bg-gray-900/95 backdrop-blur-xl border border-cyan-500/30 p-3 rounded-lg shadow-2xl">
                            <p className="text-cyan-400 font-mono text-sm font-bold mb-2">{data.name}</p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-400">调用次数:</span>
                                <span className="text-white font-mono">{formatNumber(data.value)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Tokens:</span>
                                <span className="text-purple-400 font-mono">{formatTokens(data.payload.tokens)}</span>
                              </div>
                              <div className="flex justify-between gap-4 pt-1 border-t border-gray-700">
                                <span className="text-gray-400">占比:</span>
                                <span className="text-emerald-400 font-mono">{total > 0 ? (data.value / total * 100).toFixed(2) : 0}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <span className="text-lg font-bold text-white tracking-tight drop-shadow-lg">
                    {pieData.length}
                  </span>
                  <p className="text-[10px] text-cyan-500 font-mono tracking-widest uppercase">Models</p>
                </div>
              </div>
            </div>
            <div className="w-1/2 overflow-y-auto custom-scrollbar pr-1 space-y-1">
              {pieData.map((entry, idx) => (
                <div 
                  key={idx}
                  className={`flex justify-between items-center text-xs p-1.5 rounded transition-all ${
                    activeIdx === idx ? 'bg-gray-700/80 border border-cyan-500/30' : 'hover:bg-gray-800/50'
                  }`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseLeave={() => setActiveIdx(null)}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }} 
                    />
                    <span className="text-gray-300 truncate font-mono" title={entry.name}>{entry.name}</span>
                  </div>
                  <span className="text-gray-400 font-mono flex-shrink-0">{formatNumber(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function NewApiDashboard() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  
  const [overview, setOverview] = useState({ totalCostCNY: 0, totalTokens: 0, totalRequests: 0 });
  const [dailyOverview, setDailyOverview] = useState({ totalCostCNY: 0, totalTokens: 0, totalRequests: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [trend, setTrend] = useState([]);
  const [modelDist, setModelDist] = useState([]);
  
  const [leaderboardTab, setLeaderboardTab] = useState('daily');
  const [leaderboardType, setLeaderboardType] = useState('quota');
  const [selectedToken, setSelectedToken] = useState(null);
  const [hoveredProgressBar, setHoveredProgressBar] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      
      const [
        overviewRes,
        datesRes,
        trendRes,
        dailyRes,
        leaderboardRes,
        modelRes
      ] = await Promise.all([
        fetch('/api/newapi/overview', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/newapi/available-dates', { headers }).then(r => r.json()).catch(() => []),
        fetch('/api/newapi/trend?days=30', { headers }).then(r => r.json()).catch(() => []),
        fetch(`/api/newapi/daily-overview?date=${selectedDate}`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`/api/newapi/leaderboard?type=${leaderboardType}&limit=20${leaderboardTab === 'daily' ? `&date=${selectedDate}` : ''}`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`/api/newapi/model-distribution${leaderboardTab === 'daily' ? `?date=${selectedDate}` : ''}`, { headers }).then(r => r.json()).catch(() => [])
      ]);

      setOverview(overviewRes);
      setAvailableDates(datesRes || []);
      setTrend(trendRes || []);
      setDailyOverview(dailyRes);
      setLeaderboard(leaderboardRes || []);
      setModelDist(modelRes || []);
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, leaderboardTab, leaderboardType]);

  useEffect(() => {
    if (!selectedToken) {
      fetchData();
      const interval = setInterval(fetchData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, selectedToken]);

  const handlePrevDate = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex < availableDates.length - 1) {
      setSelectedDate(availableDates[currentIndex + 1]);
    } else {
      setSelectedDate(dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD'));
    }
  };

  const handleNextDate = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex > 0) {
      setSelectedDate(availableDates[currentIndex - 1]);
    } else {
      const nextDay = dayjs(selectedDate).add(1, 'day');
      if (nextDay.isBefore(dayjs()) || nextDay.isSame(dayjs(), 'day')) {
        setSelectedDate(nextDay.format('YYYY-MM-DD'));
      }
    }
  };

  const trendData = useMemo(() => {
    return trend.map(item => ({
      ...item,
      date: dayjs(item.date).format('MM-DD'),
      cost: item.totalCostCNY,
      tokens: item.totalTokens,
      requests: item.totalRequests,
      models: item.models
    }));
  }, [trend]);

  const modelData = useMemo(() => {
    return modelDist.map((item, index) => ({
      name: item.modelName,
      value: item.totalCostCNY || 0,
      percentage: item.percentage,
      color: ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'][index % 7]
    }));
  }, [modelDist]);

  const maxLeaderboardValue = useMemo(() => {
    if (!leaderboard.length) return 1;
    const getValue = (item) => {
      if (leaderboardType === 'quota') return item.totalCostCNY;
      if (leaderboardType === 'tokens') return item.totalTokens;
      return item.totalRequests;
    };
    return Math.max(...leaderboard.map(getValue), 1);
  }, [leaderboard, leaderboardType]);

  const dateLabel = selectedDate === dayjs().format('YYYY-MM-DD') ? '今日' : selectedDate;

  const avg30Day = useMemo(() => {
    if (!trend || trend.length === 0) return { cost: 0, tokens: 0 };
    const weekdays = trend.filter(d => {
      const dow = dayjs(d.date).day();
      return dow >= 1 && dow <= 5;
    });
    if (weekdays.length === 0) return { cost: 0, tokens: 0 };
    const totalCost = weekdays.reduce((sum, d) => sum + (d.totalCostCNY || 0), 0);
    const totalTokens = weekdays.reduce((sum, d) => sum + (d.totalTokens || 0), 0);
    return {
      cost: totalCost / weekdays.length,
      tokens: totalTokens / weekdays.length
    };
  }, [trend]);

  const costPercentage = avg30Day.cost > 0 ? (dailyOverview.totalCostCNY / avg30Day.cost) * 100 : 0;
  const tokenPercentage = avg30Day.tokens > 0 ? (dailyOverview.totalTokens / avg30Day.tokens) * 100 : 0;

  if (selectedToken) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-300 font-sans selection:bg-cyan-500/30 pb-12 pt-20 px-6 max-w-7xl mx-auto">
        <TokenDetailView tokenName={selectedToken} onBack={() => setSelectedToken(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 font-sans selection:bg-cyan-500/30 pb-12">
      <header className="sticky top-14 z-40 bg-gray-950/80 backdrop-blur-md border-b border-cyan-900/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <IconActivity className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">
                <span className="text-cyan-400">NewAPI</span> 数据看板
              </h1>
              <p className="text-xs text-cyan-500/60 font-mono tracking-widest">SYSTEM STATUS: ONLINE</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-500 hidden sm:inline-block">
              UPDATED: {lastUpdated ? dayjs(lastUpdated).format('HH:mm:ss') : '--:--:--'}
            </span>
            <button 
              onClick={fetchData} 
              disabled={loading}
              className={`p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_10px_rgba(6,182,212,0.3)]'}`}
            >
              <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="总消耗金额" 
            value={formatCost(overview.totalCostCNY)} 
            subValue={`${dateLabel}: ${formatCost(dailyOverview.totalCostCNY)}`}
            icon={IconDollarSign}
            colorClass="text-emerald-400"
          />
          <StatCard 
            title="总 Token 消耗" 
            value={formatTokens(overview.totalTokens)} 
            subValue={`${dateLabel}: ${formatTokens(dailyOverview.totalTokens)}`}
            icon={IconCpu}
            colorClass="text-purple-400"
          />
          <StatCard 
            title="总调用次数" 
            value={formatNumber(overview.totalRequests)} 
            subValue={`${dateLabel}: ${formatNumber(dailyOverview.totalRequests)}`}
            icon={IconActivity}
            colorClass="text-cyan-400"
          />
          <StatCard 
            title="活跃模型数" 
            value={modelDist.length} 
            subValue={`${dateLabel}使用中`}
            icon={IconTrendingUp}
            colorClass="text-amber-400"
          />
        </div>

        <div className="flex items-center justify-between bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl px-5 py-3 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-2">
            <IconCalendar className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-medium text-gray-400">数据日期</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-800/80 rounded-lg px-3 py-1.5 border border-gray-700">
            <button 
              onClick={handlePrevDate}
              className="p-1 hover:text-cyan-400 transition-colors disabled:opacity-30"
              disabled={availableDates.length > 0 && selectedDate === availableDates[availableDates.length - 1]}
            >
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-sm font-medium text-white min-w-[120px] text-center">
              {dateLabel}
            </span>
            <button 
              onClick={handleNextDate}
              className="p-1 hover:text-cyan-400 transition-colors disabled:opacity-30"
              disabled={selectedDate === dayjs().format('YYYY-MM-DD')}
            >
              <IconChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[600px]">
          
          <div className="xl:col-span-2 bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden flex flex-col shadow-[0_0_15px_rgba(0,0,0,0.3)]">
            <div className="p-4 border-b border-gray-800 bg-gray-900/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <IconUsers className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">排行榜</h2>
              </div>
              
              <div className="flex gap-2">
                <div className="flex bg-gray-800 rounded-lg p-1">
                  <button 
                    onClick={() => setLeaderboardTab('daily')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${leaderboardTab === 'daily' ? 'bg-cyan-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    每日
                  </button>
                  <button 
                    onClick={() => setLeaderboardTab('alltime')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${leaderboardTab === 'alltime' ? 'bg-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    历史总榜
                  </button>
                </div>
                <div className="w-px h-6 bg-gray-700 mx-1 self-center" />
                <div className="flex bg-gray-800 rounded-lg p-1">
                  {[
                    { id: 'quota', label: '金额' },
                    { id: 'tokens', label: 'Token' },
                    { id: 'requests', label: '次数' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setLeaderboardType(tab.id)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${leaderboardType === tab.id ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {leaderboard.length > 0 ? (
                leaderboard.map((item, index) => {
                  let val;
                  if (leaderboardType === 'quota') val = item.totalCostCNY;
                  else if (leaderboardType === 'tokens') val = item.totalTokens;
                  else val = item.totalRequests;
                  return (
                    <LeaderboardRow 
                      key={index}
                      rank={item.rank || index + 1}
                      name={item.tokenName}
                      value={val}
                      maxValue={maxLeaderboardValue}
                      type={leaderboardType}
                      onClick={() => setSelectedToken(item.tokenName)}
                    />
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                  <IconActivity className="w-12 h-12 mb-2" />
                  <p className="text-sm font-mono">暂无数据</p>
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-1 flex flex-col">
            <div className="bg-gray-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 shadow-[0_0_15px_rgba(0,0,0,0.3)] flex-1 flex flex-col">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <IconActivity className="w-5 h-5 text-emerald-400" />
                {dateLabel === '今日' ? '今日概览详情' : `${dateLabel} 概览详情`}
              </h2>
              
              <div className="flex flex-col gap-4">
                <div className="space-y-2 relative"
                  onMouseEnter={() => setHoveredProgressBar('cost')}
                  onMouseLeave={() => setHoveredProgressBar(null)}
                >
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">消耗金额占比</span>
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        costPercentage >= 200 ? 'bg-red-500/20 text-red-400' :
                        costPercentage >= 150 ? 'bg-orange-500/20 text-orange-400' :
                        costPercentage >= 100 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>{costPercentage.toFixed(0)}%</span>
                    </div>
                    <span className={`font-mono font-bold ${
                      costPercentage >= 200 ? 'text-red-400' :
                      costPercentage >= 150 ? 'text-orange-400' :
                      costPercentage >= 100 ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>{formatCost(dailyOverview.totalCostCNY)}</span>
                  </div>
                  <div className={`h-3 bg-gray-800 rounded-full overflow-hidden cursor-pointer transition-all ${
                    costPercentage >= 200 ? 'border border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.3)]' :
                    costPercentage >= 150 ? 'border border-orange-500/40 shadow-[0_0_6px_rgba(249,115,22,0.2)]' :
                    'border border-gray-700/50'
                  }`}>
                    <div 
                      className={`h-full transition-all duration-500 ${
                        costPercentage >= 200 ? 'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' :
                        costPercentage >= 150 ? 'bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.4)]' :
                        costPercentage >= 100 ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]' :
                        'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      }`}
                      style={{ width: `${Math.min(100, costPercentage)}%` }} 
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-right">较30天平均</p>
                  {hoveredProgressBar === 'cost' && (
                    <div className={`absolute left-1/2 -translate-x-1/2 -top-16 bg-gray-900/95 backdrop-blur-xl border rounded-lg px-4 py-2.5 shadow-2xl z-10 whitespace-nowrap ${
                      costPercentage >= 200 ? 'border-red-500/40' :
                      costPercentage >= 150 ? 'border-orange-500/40' :
                      'border-emerald-500/40'
                    }`}>
                      <p className={`text-xs font-mono font-bold ${
                        costPercentage >= 200 ? 'text-red-400' :
                        costPercentage >= 150 ? 'text-orange-400' :
                        'text-emerald-400'
                      }`}>{costPercentage.toFixed(1)}% <span className="text-gray-400 font-normal">of 30日均值</span></p>
                      <p className="text-xs text-gray-300 font-mono mt-1">30日均值: {formatCost(avg30Day.cost)}</p>
                      <div className={`absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-gray-900/95 border-b border-r rotate-45 ${
                        costPercentage >= 200 ? 'border-red-500/40' :
                        costPercentage >= 150 ? 'border-orange-500/40' :
                        'border-emerald-500/40'
                      }`} />
                    </div>
                  )}
                </div>

                <div className="space-y-2 relative"
                  onMouseEnter={() => setHoveredProgressBar('token')}
                  onMouseLeave={() => setHoveredProgressBar(null)}
                >
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Token 消耗占比</span>
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        tokenPercentage >= 200 ? 'bg-red-500/20 text-red-400' :
                        tokenPercentage >= 150 ? 'bg-orange-500/20 text-orange-400' :
                        tokenPercentage >= 100 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-cyan-500/20 text-cyan-400'
                      }`}>{tokenPercentage.toFixed(0)}%</span>
                    </div>
                    <span className={`font-mono font-bold ${
                      tokenPercentage >= 200 ? 'text-red-400' :
                      tokenPercentage >= 150 ? 'text-orange-400' :
                      tokenPercentage >= 100 ? 'text-amber-400' :
                      'text-cyan-400'
                    }`}>{formatTokens(dailyOverview.totalTokens)}</span>
                  </div>
                  <div className={`h-3 bg-gray-800 rounded-full overflow-hidden cursor-pointer transition-all ${
                    tokenPercentage >= 200 ? 'border border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.3)]' :
                    tokenPercentage >= 150 ? 'border border-orange-500/40 shadow-[0_0_6px_rgba(249,115,22,0.2)]' :
                    'border border-gray-700/50'
                  }`}>
                    <div 
                      className={`h-full transition-all duration-500 ${
                        tokenPercentage >= 200 ? 'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' :
                        tokenPercentage >= 150 ? 'bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.4)]' :
                        tokenPercentage >= 100 ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]' :
                        'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                      }`}
                      style={{ width: `${Math.min(100, tokenPercentage)}%` }} 
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-right">较30天平均</p>
                  {hoveredProgressBar === 'token' && (
                    <div className={`absolute left-1/2 -translate-x-1/2 -top-16 bg-gray-900/95 backdrop-blur-xl border rounded-lg px-4 py-2.5 shadow-2xl z-10 whitespace-nowrap ${
                      tokenPercentage >= 200 ? 'border-red-500/40' :
                      tokenPercentage >= 150 ? 'border-orange-500/40' :
                      'border-cyan-500/40'
                    }`}>
                      <p className={`text-xs font-mono font-bold ${
                        tokenPercentage >= 200 ? 'text-red-400' :
                        tokenPercentage >= 150 ? 'text-orange-400' :
                        'text-cyan-400'
                      }`}>{tokenPercentage.toFixed(1)}% <span className="text-gray-400 font-normal">of 30日均值</span></p>
                      <p className="text-xs text-gray-300 font-mono mt-1">30日均值: {formatTokens(avg30Day.tokens)}</p>
                      <div className={`absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-gray-900/95 border-b border-r rotate-45 ${
                        tokenPercentage >= 200 ? 'border-red-500/40' :
                        tokenPercentage >= 150 ? 'border-orange-500/40' :
                        'border-cyan-500/40'
                      }`} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 mt-3">
                  <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50 flex justify-between items-center group hover:bg-gray-800/60 transition-colors">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Prompt (Input)</p>
                      <div className="w-16 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${dailyOverview.totalTokens > 0 ? (dailyOverview.totalPromptTokens / dailyOverview.totalTokens) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-white font-mono group-hover:text-amber-400 transition-colors">
                      {formatTokens(dailyOverview.totalPromptTokens)}
                    </p>
                  </div>
                  
                  <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/50 flex justify-between items-center group hover:bg-gray-800/60 transition-colors">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Completion (Output)</p>
                      <div className="w-16 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${dailyOverview.totalTokens > 0 ? (dailyOverview.totalCompletionTokens / dailyOverview.totalTokens) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-white font-mono group-hover:text-purple-400 transition-colors">
                      {formatTokens(dailyOverview.totalCompletionTokens)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1">
          <ModelAnalytics />
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(17, 24, 39, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.5);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
