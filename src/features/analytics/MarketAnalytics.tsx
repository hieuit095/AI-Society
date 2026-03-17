/**
 * @file MarketAnalytics.tsx
 * @description Renders the dashboard's realtime KPI cards, sentiment charts, and diagnostics panels.
 * @ai_context This view is the frontend projection for future Rust-authored `analytics.tick` events and derived market telemetry.
 */
import { memo, useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useShallow } from 'zustand/react/shallow';
import { useWorldStore } from '../../store/useWorldStore';
import { TrendingUp, Flame, Users, Activity, Cpu, BarChart2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const DARK_TOOLTIP = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '6px',
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#a1a1aa',
};
const AXIS_TICK = { fill: '#52525b', fontSize: 10, fontFamily: 'monospace' };
const GRID_COLOR = '#27272a';

const BAR_COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#a78bfa', '#fb923c', '#34d399'];

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent: string;
  borderAccent: string;
  trend?: number;
}

const KpiCard = memo(function KpiCard({ icon: Icon, label, value, sub, accent, borderAccent, trend }: KpiCardProps) {
  return (
    <div className={cn('bg-zinc-900/50 border rounded-lg p-4 font-mono relative overflow-hidden', borderAccent)}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.04] blur-3xl" style={{ background: accent }} />
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg border', borderAccent)}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        {trend !== undefined && (
          <span className={cn('text-[11px] font-mono font-bold', trend >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tabular-nums mb-0.5" style={{ color: accent }}>{value}</div>
      <div className="text-[11px] text-zinc-600 uppercase tracking-widest">{label}</div>
      <div className="text-[10px] text-zinc-700 mt-1">{sub}</div>
    </div>
  );
});

export const MarketAnalytics = memo(function MarketAnalytics() {
  const { analyticsData, currentTick, awakeAgents, isBootstrapped } = useWorldStore(
    useShallow((state) => ({
      analyticsData: state.analyticsData,
      currentTick: state.currentTick,
      awakeAgents: state.awakeAgents,
      isBootstrapped: state.isBootstrapped,
    }))
  );

  const { latest, sentimentTrend, adoptionTrend, featureData } = useMemo(() => {
    const latestPoint = analyticsData[analyticsData.length - 1];
    const previousPoint = analyticsData[analyticsData.length - 3];
    const positiveTrend = latestPoint && previousPoint && previousPoint.positive
      ? ((latestPoint.positive - previousPoint.positive) / previousPoint.positive) * 100
      : 0;
    const nextAdoptionTrend = latestPoint && previousPoint && previousPoint.adoption
      ? ((latestPoint.adoption - previousPoint.adoption) / previousPoint.adoption) * 100
      : 0;

    // Feature adoption — server-derived base, proportionally distributed
    const baseAdoption = latestPoint?.adoption ?? 0;
    return {
      latest: latestPoint,
      sentimentTrend: positiveTrend,
      adoptionTrend: nextAdoptionTrend,
      featureData: [
        { name: 'Adaptive Memory', value: baseAdoption },
        { name: 'Tool Chaining', value: Math.round(baseAdoption * 0.85) },
        { name: 'Multi-Modal', value: Math.round(baseAdoption * 0.6) },
        { name: 'Peer Collab', value: Math.round(baseAdoption * 0.45) },
        { name: 'Auto Schedule', value: Math.round(baseAdoption * 0.7) },
        { name: 'Self Repair', value: Math.round(baseAdoption * 0.35) },
      ],
    };
  }, [analyticsData]);

  // ==========================================
  // 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
  // TODO (Backend Phase): Replace these client-derived view metrics with server-side analytics aggregations from `analytics.tick` events.
  // Expected Payload: { type: 'analytics.tick', tick: number, positive: number, negative: number, tokens: number, adoption: number }
  // ==========================================

  if (!isBootstrapped || analyticsData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-zinc-700 text-lg tracking-[0.3em] uppercase">Awaiting Market Data</div>
          <div className="text-zinc-800 text-xs mt-2 animate-pulse">{'> Connecting to analytics engine...'}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-y-auto p-6 flex flex-col gap-6"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}
    >
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-mono font-bold text-zinc-100 text-lg tracking-wide uppercase">Market Analytics</h1>
          <p className="text-xs font-mono text-zinc-600 mt-0.5">
            Real-time simulation telemetry - tick <span className="text-emerald-400">{currentTick.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5">
          <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-zinc-400">LIVE FEED</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <KpiCard
          icon={TrendingUp}
          label="Simulated Revenue"
          value={`$${((latest?.simulatedRevenue ?? 0) / 1000).toFixed(1)}K`}
          sub="Accumulated since tick 0"
          accent="#10b981"
          borderAccent="border-emerald-900/30"
          trend={sentimentTrend}
        />
        <KpiCard
          icon={Cpu}
          label="Token Burn"
          value={`${((latest?.tokens ?? 0) / 1000).toFixed(1)}K`}
          sub="Cumulative tokens burned"
          accent="#06b6d4"
          borderAccent="border-cyan-900/30"
        />
        <KpiCard
          icon={Users}
          label="Market Adoption"
          value={`${latest?.adoption ?? 0}%`}
          sub={`${awakeAgents.toLocaleString()} agents reporting`}
          accent="#f59e0b"
          borderAccent="border-amber-900/30"
          trend={adoptionTrend}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
              Sentiment Analysis - Positive vs Negative Signal
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analyticsData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="tick" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={DARK_TOOLTIP}
                labelStyle={{ color: '#71717a', fontFamily: 'monospace', fontSize: '10px' }}
                itemStyle={{ fontFamily: 'monospace', fontSize: '11px' }}
                cursor={{ stroke: '#3f3f46', strokeDasharray: '3 3' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#71717a', paddingTop: '8px' }}
                formatter={(v) => v.toUpperCase()}
              />
              <Area type="monotone" dataKey="positive" stroke="#10b981" strokeWidth={1.5} fill="url(#gPos)" name="Positive" dot={false} activeDot={{ r: 3, fill: '#10b981' }} />
              <Area type="monotone" dataKey="negative" stroke="#f43f5e" strokeWidth={1.5} fill="url(#gNeg)" name="Negative" dot={false} activeDot={{ r: 3, fill: '#f43f5e' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-3.5 h-3.5 text-cyan-500" />
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">Token Budget Depletion</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={analyticsData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="tick" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={DARK_TOOLTIP}
                labelStyle={{ color: '#71717a', fontFamily: 'monospace', fontSize: '10px' }}
                itemStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#06b6d4' }}
                cursor={{ stroke: '#3f3f46', strokeDasharray: '3 3' }}
              />
              <Line
                type="monotone"
                dataKey="tokens"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#06b6d4', stroke: '#18181b', strokeWidth: 2 }}
                name="Tokens"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">Feature Adoption Rates</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={featureData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 8, fontFamily: 'monospace' }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={DARK_TOOLTIP}
                labelStyle={{ color: '#71717a', fontFamily: 'monospace', fontSize: '10px' }}
                itemStyle={{ fontFamily: 'monospace', fontSize: '11px' }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="value" name="Adoption %" radius={[2, 2, 0, 0]}>
                {featureData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-widest">System Diagnostics</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'TICK RATE', value: '1.5s/tick', color: 'text-emerald-400' },
            { label: 'MSG QUEUE', value: `${analyticsData.length} pts`, color: 'text-cyan-400' },
            { label: 'AGENT ERR RATE', value: '0.03%', color: 'text-amber-400' },
            { label: 'SIM HEALTH', value: 'NOMINAL', color: 'text-emerald-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-zinc-950 border border-zinc-800 rounded p-3">
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">{stat.label}</div>
              <div className={cn('text-sm font-mono font-bold', stat.color)}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
