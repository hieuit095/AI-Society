/**
 * @file Citizens.tsx
 * @description Renders the searchable citizen registry table with DOM virtualization for 1000+ agents.
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWorldStore } from '../../store/useWorldStore';
import { Citizen } from '../../types';

const ROW_HEIGHT = 48;

function roleBadgeClass(role: string): string {
  if (role.includes('CEO') || role.includes('CTO') || role.includes('CFO')) {
    return 'bg-amber-950/50 border-amber-800/50 text-amber-300';
  }
  if (role.includes('Engineer') || role.includes('Analyst') || role.includes('Researcher')) {
    return 'bg-cyan-950/50 border-cyan-800/50 text-cyan-300';
  }
  if (role.includes('Consumer')) {
    return 'bg-emerald-950/50 border-emerald-800/50 text-emerald-300';
  }
  if (role.includes('Legal')) {
    return 'bg-rose-950/50 border-rose-800/50 text-rose-300';
  }
  return 'bg-zinc-800 border-zinc-700 text-zinc-300';
}

interface CitizenRowProps {
  citizen: Citizen;
  onInspect: (citizen: Citizen) => void;
}

const CitizenRow = memo(function CitizenRow({ citizen, onInspect }: CitizenRowProps) {
  return (
    <tr
      onClick={() => onInspect(citizen)}
      className="hover:bg-zinc-800/50 cursor-pointer border-b border-zinc-800/50 transition-colors duration-100 group"
    >
      <td className="px-4 py-3 text-sm font-mono text-zinc-500">{citizen.id}</td>
      <td className="px-4 py-3 text-sm font-bold text-zinc-200">{citizen.name}</td>
      <td className="px-4 py-3 text-sm">
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono border ${roleBadgeClass(citizen.role)}`}>
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
          onClick={(event) => {
            event.stopPropagation();
            onInspect(citizen);
          }}
          className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded bg-zinc-800 text-emerald-500 border border-zinc-700 hover:bg-emerald-950/50 hover:border-emerald-700 transition-colors duration-200 opacity-0 group-hover:opacity-100"
        >
          Inspect
        </button>
      </td>
    </tr>
  );
});

export const Citizens = memo(function Citizens() {
  const citizens = useWorldStore((state) => state.citizens);
  const setSelectedAgent = useWorldStore((state) => state.setSelectedAgent);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const roleOptions = useMemo(
    () => ['All Roles', ...Array.from(new Set(citizens.map((citizen) => citizen.role))).sort()],
    [citizens]
  );

  const inspectCitizen = useCallback((citizen: Citizen) => {
    setSelectedAgent({
      id: citizen.id,
      name: citizen.name,
      role: citizen.role,
      roleColor: citizen.role.includes('Legal')
        ? 'rose'
        : citizen.role.includes('Engineer')
          ? 'sky'
          : citizen.role.includes('Researcher')
            ? 'cyan'
            : citizen.role.includes('Consumer')
              ? 'amber'
              : 'emerald',
      avatarInitials: citizen.name.slice(0, 2).toUpperCase(),
      status: citizen.status === 'Awake' ? 'awake' : 'idle',
    });
  }, [setSelectedAgent]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return citizens.filter((citizen) => {
      const matchSearch = !query || citizen.id.toLowerCase().includes(query) || citizen.name.toLowerCase().includes(query);
      const matchRole = roleFilter === 'All Roles' || citizen.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [citizens, roleFilter, search]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const topPadding = virtualItems[0]?.start ?? 0;
  const bottomPadding = virtualItems.length > 0
    ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  return (
    <div className="h-full w-full p-6 flex flex-col gap-4 bg-zinc-950 text-zinc-300 overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            placeholder="> Search Citizen ID or Name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-zinc-900 border border-zinc-800 focus:border-emerald-500 text-emerald-400 font-mono text-xs pl-8 pr-3 py-2 rounded w-64 md:w-96 outline-none transition-colors duration-200 placeholder:text-zinc-700"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-2 rounded font-mono text-xs outline-none focus:border-emerald-600 transition-colors duration-200 cursor-pointer"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>{role}</option>
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
              {['ID', 'NAME', 'ROLE', 'STATUS', 'RAM USAGE', 'ACTIONS'].map((header) => (
                <th
                  key={header}
                  className="bg-zinc-950/90 sticky top-0 font-mono text-xs text-zinc-500 tracking-widest uppercase px-4 py-3 border-b border-zinc-800 z-10 backdrop-blur font-semibold"
                >
                  {header}
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
                <tr style={{ height: topPadding }}>
                  <td colSpan={6} />
                </tr>
                {virtualItems.map((virtualRow) => (
                  <CitizenRow
                    key={filtered[virtualRow.index].id}
                    citizen={filtered[virtualRow.index]}
                    onInspect={inspectCitizen}
                  />
                ))}
                <tr style={{ height: bottomPadding }}>
                  <td colSpan={6} />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
