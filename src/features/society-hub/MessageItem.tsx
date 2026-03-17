/**
 * @file MessageItem.tsx
 * @description Renders a single society message row and routes agent selection into the inspector.
 * @ai_context This is the chat-to-agent drilldown bridge that will later consume unified Rust-issued agent ids and detail payloads.
 */
import { memo, useCallback } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { cn } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';
import { Agent, Message } from '../../types';

const ROLE_COLOR_MAP: Record<string, string> = {
  emerald: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50',
  amber: 'text-amber-400 bg-amber-900/30 border-amber-800/50',
  cyan: 'text-cyan-400 bg-cyan-900/30 border-cyan-800/50',
  rose: 'text-rose-400 bg-rose-900/30 border-rose-800/50',
  sky: 'text-sky-400 bg-sky-900/30 border-sky-800/50',
};

const AVATAR_COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-800 text-emerald-200',
  amber: 'bg-amber-800 text-amber-200',
  cyan: 'bg-cyan-800 text-cyan-200',
  rose: 'bg-rose-800 text-rose-200',
  sky: 'bg-sky-800 text-sky-200',
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return '--:--:--';
  }
}

interface MessageItemProps {
  message: Message;
  isNew?: boolean;
}

const SystemMessage = memo(function SystemMessage({ message, isNew }: MessageItemProps) {
  return (
    <div className={cn(
      'mx-2 my-2 px-4 py-3 rounded-lg border border-amber-900/40 bg-amber-950/20',
      isNew && 'animate-fade-in'
    )}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
        <p className="font-mono text-xs text-amber-400 leading-relaxed font-bold">{message.content}</p>
      </div>
    </div>
  );
});

export const MessageItem = memo(function MessageItem({ message, isNew }: MessageItemProps) {
  const setSelectedAgent = useWorldStore((s) => s.setSelectedAgent);

  // Agent metadata is carried directly on the message — no registry lookup needed.
  const handleAgentClick = useCallback(() => {
    const agent: Agent = {
      id: message.agentId,
      name: message.agentName,
      role: message.agentRole,
      roleColor: (message.agentRoleColor as Agent['roleColor']) || 'emerald',
      avatarInitials: message.agentAvatarInitials || '??',
      status: 'active',
    };
    setSelectedAgent(agent);
  }, [message, setSelectedAgent]);

  if (message.isSystemMessage) {
    return <SystemMessage message={message} isNew={isNew} />;
  }

  const avatarClass = AVATAR_COLOR_MAP[message.agentRoleColor] ?? 'bg-zinc-700 text-zinc-200';
  const roleClass = ROLE_COLOR_MAP[message.agentRoleColor] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700';

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-all duration-200 rounded-lg mx-2',
        isNew && 'animate-fade-in'
      )}
    >
      <button
        onClick={handleAgentClick}
        className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer hover:scale-110 transition-transform duration-150 mt-0.5"
      >
        <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs', avatarClass)}>
          {message.agentAvatarInitials}
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <button
            onClick={handleAgentClick}
            className="font-bold text-sm text-zinc-100 hover:underline cursor-pointer leading-none"
          >
            {message.agentName}
          </button>
          <span className={cn(
            'font-mono text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide leading-none',
            roleClass
          )}>
            {message.agentRole}
          </span>
          <span className="font-mono text-[10px] text-zinc-600">
            {formatTimestamp(message.timestamp)}
          </span>
          <span className="font-mono text-[10px] text-zinc-700">
            T:{message.tick.toLocaleString()}
          </span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed break-words">
          {message.content}
        </p>
      </div>
    </div>
  );
});
