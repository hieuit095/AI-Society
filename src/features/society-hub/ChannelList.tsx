/**
 * @file ChannelList.tsx
 * @description Displays the currently available society text channels and local navigation state.
 */
import { memo } from 'react';
import { Hash, Volume2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorldStore } from '../../store/useWorldStore';
import { cn } from '../../lib/utils';

const VOICE_CHANNELS = ['board-standup', 'war-room'];

export const ChannelList = memo(function ChannelList() {
  const { activeChannel, setActiveChannel, channels, awakeAgents, messagesByChannel } = useWorldStore(
    useShallow((state) => ({
      activeChannel: state.activeChannel,
      setActiveChannel: state.setActiveChannel,
      channels: state.channels,
      awakeAgents: state.awakeAgents,
      messagesByChannel: state.messagesByChannel,
    }))
  );

  const activeMessageCount = messagesByChannel[activeChannel]?.length ?? 0;

  return (
    <div className="w-48 shrink-0 bg-zinc-900/50 border-r border-zinc-800/50 flex flex-col overflow-hidden">
      <div className="px-3 py-3 border-b border-zinc-800/50">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Society Hub</h2>
        <p className="text-[10px] text-zinc-600 font-mono mt-0.5">AI Agent Network v3.1</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">Text Channels</span>
        </div>

        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => setActiveChannel(channel.id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md mx-1 transition-all duration-150',
              activeChannel === channel.id
                ? 'bg-zinc-700/50 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
            )}
          >
            <Hash className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono flex-1 text-left truncate">{channel.name}</span>
            {channel.unread && channel.unread > 0 && (
              <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                {channel.unread > 9 ? '9+' : channel.unread}
              </span>
            )}
          </button>
        ))}

        <div className="px-3 py-1.5 mt-2">
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">Voice Nodes</span>
        </div>

        {VOICE_CHANNELS.map((name) => (
          <button
            key={name}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md mx-1 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30 transition-all duration-150"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono">{name}</span>
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-zinc-800/50 bg-zinc-950/30">
        <div className="text-[10px] font-mono text-zinc-600 space-y-1">
          <div className="flex justify-between">
            <span>AGENTS ONLINE</span>
            <span className="text-emerald-500">{awakeAgents.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>CHANNEL MSGS</span>
            <span className="text-amber-500">{activeMessageCount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
