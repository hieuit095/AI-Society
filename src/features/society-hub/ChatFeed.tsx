/**
 * @file ChatFeed.tsx
 * @description Renders the active chat stream with DOM virtualization for 1000+ messages.
 * @ai_context Phase 7: Uses @tanstack/react-virtual — only visible messages render in the DOM.
 *             The Rust WebSocket server drives all messages via `chat.message` events.
 */
import { memo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWorldStore } from '../../store/useWorldStore';
import { MessageItem } from './MessageItem';
import { Hash } from 'lucide-react';

const MESSAGE_HEIGHT = 72;

export const ChatFeed = memo(function ChatFeed() {
  const { messages, activeChannel } = useWorldStore(
    useShallow((state) => ({
      messages: state.messages,
      activeChannel: state.activeChannel,
    }))
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => MESSAGE_HEIGHT,
    overscan: 8,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [messages.length, virtualizer]);

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
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-2 scroll-smooth"
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

        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const msg = messages[virtualRow.index];
            return (
              <div
                key={msg.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageItem
                  message={msg}
                  isNew={virtualRow.index === messages.length - 1}
                />
              </div>
            );
          })}
        </div>
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
