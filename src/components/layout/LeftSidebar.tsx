/**
 * @file LeftSidebar.tsx
 * @description Hosts persistent view navigation for the God-Mode dashboard.
 * @ai_context This component stays client-owned, but its navigation targets map directly to the Rust-backed society, map, analytics, and citizens surfaces.
 */
import { memo } from 'react';
import { Zap, Globe, MessageSquare, Users, BarChart2, Settings } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../lib/utils';
import { useWorldStore } from '../../store/useWorldStore';
import { WorldView } from '../../types';

interface NavItem {
  icon: React.ElementType;
  label: string;
  view: WorldView;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Globe, label: 'World Map', view: 'map' },
  { icon: MessageSquare, label: 'Society Hub', view: 'hub' },
  { icon: Users, label: 'Citizens', view: 'citizens' },
  { icon: BarChart2, label: 'Analytics', view: 'analytics' },
  { icon: Settings, label: 'Settings', view: 'settings' },
];

export const LeftSidebar = memo(function LeftSidebar() {
  const { currentView, setCurrentView } = useWorldStore(
    useShallow((state) => ({
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
    }))
  );

  return (
    <aside className="group fixed left-0 top-14 bottom-0 z-20 w-16 hover:w-56 transition-all duration-300 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800 h-14 shrink-0">
        <div className="w-8 h-8 shrink-0 flex items-center justify-center">
          <Zap className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        </div>
        <span className="text-emerald-400 font-bold text-xs tracking-[0.3em] uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100">
          ZEROCLAW
        </span>
      </div>

      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 w-full text-left group/item relative',
                isActive
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 shadow-[inset_2px_0_0_0_rgba(52,211,153,0.6)]'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'
              )}
            >
              <item.icon
                className={cn(
                  'shrink-0 transition-all duration-200',
                  isActive
                    ? 'text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]'
                    : 'text-zinc-500 group-hover/item:text-zinc-200'
                )}
                style={{ width: '18px', height: '18px' }}
              />
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 font-mono tracking-wide uppercase text-[11px]">
                {item.label}
              </span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 shrink-0 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-zinc-800 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/50">
          <div className="w-[18px] h-[18px] shrink-0 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-[8px] font-bold text-zinc-900">G</span>
          </div>
          <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 font-mono text-[11px] text-zinc-400 tracking-wide">
            GOD_OPERATOR
          </span>
        </div>
      </div>
    </aside>
  );
});
