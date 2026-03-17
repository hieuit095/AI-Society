/**
 * @file Citizens.tsx
 * @description Renders the searchable citizen registry table with DOM virtualization for 1000+ agents.
 * @ai_context Uses @tanstack/react-virtual to render only visible rows in the DOM.
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWorldStore } from '../../store/useWorldStore';
import { Citizen } from '../../types';

const ROLES = ['All Roles', 'CEO', 'CTO', 'Engineer', 'Consumer', 'Researcher', 'Analyst'];

const ROLE_BADGE: Record<string, string> = {
  CEO: 'bg-amber-950/50 border-amber-800/50 text-amber-300',
  CTO: 'bg-amber-950/50 border-amber-800/50 text-amber-300',
  Engineer: 'bg-cyan-950/50 border-cyan-800/50 text-cyan-300',
  Analyst: 'bg-cyan-950/50 border-cyan-800/50 text-cyan-300',
  Consumer: 'bg-emerald-950/50 border-emerald-800/50 text-emerald-300',
  Researcher: 'bg-emerald-950/50 border-emerald-800/50 text-emerald-300',
};

interface CitizenRowProps {
  citizen: Citizen;
  onInspect: (citizen: Citizen) => void;
}

const CitizenRow = memo(function CitizenRow({ citizen, onInspect }: CitizenRowProps) {
  const handleRowClick = () => onInspect(citizen);
  const handleInspectClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onInspect(citizen);
  };

  return (
    <tr
      onClick={handleRowClick}
      className="hover:bg-zinc-800/50 cursor-pointer border-b border-zinc-800/50 transition-colors duration-100 group"
    >
      <td className="px-4 py-3 text-sm font-mono text-zinc-500">{citizen.id}</td>

      <td className="px-4 py-3 text-sm font-bold text-zinc-200">{citizen.name}</td>

      <td className="px-4 py-3 text-sm">
        <span className={`inline-block bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono ${ROLE_BADGE[citizen.role] ?? ''}`}>
          {citizen.role}
        </span>
      </td>

      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${citizen.status === 'Awake' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}
          />
          <span className={citizen.status === 'Awake' ? 'text-emerald-400' : 'text-zinc-600'}>{citizen.status}</span>
        </div>
      </td>

      <td className="px-4 py-3 text-sm font-mono text-zinc-600">{citizen.memoryUsage}</td>

      <td className="px-4 py-3 text-sm">
        <button
          onClick={handleInspectClick}
          className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded bg-zinc-800 text-emerald-500 border border-zinc-700 hover:bg-emerald-950/50 hover:border-emerald-700 transition-colors duration-200 opacity-0 group-hover:opacity-100"
        >
          Inspect
        </button>
      </td>
    </tr>
  );
});

const ROW_HEIGHT = 48;

export const Citizens = memo(function Citizens() {
  const citizens = useWorldStore((s) => s.citizens);
  const setSelectedAgent = useWorldStore((s) => s.setSelectedAgent);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const inspectCitizen = useCallback((citizen: Citizen) => {
    setSelectedAgent({
      id: citizen.id,
      name: citizen.name,
      role: citizen.role,
      roleColor: 'emerald',
      avatarInitials: citizen.name.slice(0, 2).toUpperCase(),
      status: citizen.status === 'Awake' ? 'active' : 'idle',
    });
  }, [setSelectedAgent]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return citizens.filter((c) => {
      const matchSearch = !q || c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
      const matchRole = roleFilter === 'All Roles' || c.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [citizens, search, roleFilter]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="h-full w-full p-6 flex flex-col gap-4 bg-zinc-950 text-zinc-300 overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            placeholder="> Search Citizen ID or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 focus:border-emerald-500 text-emerald-400 font-mono text-xs pl-8 pr-3 py-2 rounded w-64 md:w-96 outline-none transition-colors duration-200 placeholder:text-zinc-700"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-2 rounded font-mono text-xs outline-none focus:border-emerald-600 transition-colors duration-200 cursor-pointer"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <span className="font-mono text-xs text-zinc-600 ml-auto">
          <span className="text-zinc-400 font-bold">{filtered.length}</span> / {citizens.length} agents
        </span>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto border border-zinc-800 rounded-lg bg-zinc-900/30"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}
      >
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr>
              {['ID', 'NAME', 'ROLE', 'STATUS', 'RAM USAGE', 'ACTIONS'].map((h) => (
                <th
                  key={h}
                  className="bg-zinc-950/90 sticky top-0 font-mono text-xs text-zinc-500 tracking-widest uppercase px-4 py-3 border-b border-zinc-800 z-10 backdrop-blur font-semibold"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center font-mono text-sm text-zinc-700">
                  No agents match the current filters.
                </td>
              </tr>
            ) : (
              <>
                <tr style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0 }}>
                  <td colSpan={6} />
                </tr>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const citizen = filtered[virtualRow.index];
                  return (
                    <CitizenRow
                      key={citizen.id}
                      citizen={citizen}
                      onInspect={inspectCitizen}
                    />
                  );
                })}
                {(() => {
                  const items = virtualizer.getVirtualItems();
                  const lastEnd = items.length > 0 ? items[items.length - 1].end : 0;
                  return (
                    <tr style={{ height: virtualizer.getTotalSize() - lastEnd }}>
                      <td colSpan={6} />
                    </tr>
                  );
                })()}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
