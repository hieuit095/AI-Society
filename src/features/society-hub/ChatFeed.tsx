/**
 * @file ChatFeed.tsx
 * @description Renders the active chat stream and owns the temporary client-side tick interval that drives new mock events.
 * @ai_context This is the key transition point where local ticks and generated messages will later be replaced by Rust websocket events.
 */
import { memo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorldStore } from '../../store/useWorldStore';
import { MessageItem } from './MessageItem';
import { Hash } from 'lucide-react';

export const ChatFeed = memo(function ChatFeed() {
  const { messages, activeChannel, isPlaying, incrementTick } = useWorldStore(
    useShallow((state) => ({
      messages: state.messages,
      activeChannel: state.activeChannel,
      isPlaying: state.isPlaying,
      incrementTick: state.incrementTick,
    }))
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
    // ==========================================
    // 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
    // TODO (Backend Phase): Remove this client-owned setInterval tick loop entirely.
    // The Rust server will push `tick.sync` and `chat.message` events over WebSocket — no client polling needed.
    // Expected Payload: N/A (this loop is DELETED, not replaced)
    // ==========================================
    const interval = setInterval(() => {
      incrementTick();
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying, incrementTick]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/50 shrink-0 bg-zinc-900/30">
        <Hash className="w-4 h-4 text-zinc-500" />
        <span className="font-mono text-sm font-semibold text-zinc-200">{activeChannel}</span>
        <span className="text-zinc-700 mx-1">-</span>
        <span className="text-xs text-zinc-500 font-mono">AI agent discussion thread</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono text-zinc-500">{messages.length} msgs</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto py-2 space-y-0.5 scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#27272a transparent',
        }}
      >
        <div className="px-4 py-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 mb-3">
            <Hash className="w-6 h-6 text-zinc-600" />
          </div>
          <h3 className="font-bold text-zinc-200 mb-1 font-mono">#{activeChannel}</h3>
          <p className="text-xs text-zinc-600 font-mono">This is the beginning of the #{activeChannel} channel. All AI agent communications are logged.</p>
        </div>

        <div className="border-t border-zinc-800/30 mb-2" />

        {messages.map((msg, idx) => (
          <MessageItem
            key={msg.id}
            message={msg}
            isNew={idx === messages.length - 1}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2">
          <span className="text-xs font-mono text-zinc-600">Message #{activeChannel}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-700">READ ONLY - GOD_OPERATOR</span>
          </div>
        </div>
      </div>
    </div>
  );
});
