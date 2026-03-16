/**
 * @file SocietyHub.tsx
 * @description Composes the chat channels, message feed, and inspector into the primary realtime operations view.
 * @ai_context This is the main operator console that will be hydrated by Rust-authored channel, message, and agent detail events.
 */
import { memo } from 'react';
import { ChannelList } from './ChannelList';
import { ChatFeed } from './ChatFeed';
import { AgentInspector } from '../inspector/AgentInspector';

export const SocietyHub = memo(function SocietyHub() {
  return (
    <div className="flex h-full w-full relative overflow-hidden">
      <ChannelList />
      <ChatFeed />
      <AgentInspector />
    </div>
  );
});
