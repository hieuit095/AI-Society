/**
 * @file wsClient.ts
 * @description WebSocket client service that connects to the Rust society-server.
 */

import { useWorldStore } from '../store/useWorldStore';

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WS_HOST = window.location.hostname || 'localhost';
const WS_URL = `${WS_PROTOCOL}://${WS_HOST}:4000/ws`;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

interface Envelope<T> {
  schemaVersion: number;
  worldId: string;
  sequence: number;
  sentAt: string;
  eventType: string;
  payload: T;
}

let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let teardownTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = RECONNECT_DELAY_MS;
let outboundSequence = 0;
let expectedInboundSequence = 1;
let resyncInFlight = false;

function createEnvelope<T>(eventType: string, payload: T): Envelope<T> {
  outboundSequence += 1;
  return {
    schemaVersion: 1,
    worldId: 'default',
    sequence: outboundSequence,
    sentAt: new Date().toISOString(),
    eventType,
    payload,
  };
}

export function connectWebSocket(): void {
  if (teardownTimeout) {
    clearTimeout(teardownTimeout);
    teardownTimeout = null;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    reconnectDelay = RECONNECT_DELAY_MS;
    useWorldStore.getState().setConnectionStatus('stable');
  };

  socket.onmessage = (event) => {
    try {
      const envelope = JSON.parse(event.data) as Envelope<Record<string, unknown>>;
      handleServerEvent(envelope);
    } catch (error) {
      console.warn('[WS] Failed to parse message:', error);
    }
  };

  socket.onclose = () => {
    socket = null;
    useWorldStore.getState().setConnectionStatus('degraded');
    scheduleReconnect();
  };

  socket.onerror = (error) => {
    console.warn('[WS] Error:', error);
    socket?.close();
  };
}

export function disconnectWebSocket(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (socket) {
    if (teardownTimeout) {
      clearTimeout(teardownTimeout);
    }

    teardownTimeout = setTimeout(() => {
      teardownTimeout = null;
      if (!socket) return;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
      socket = null;
    }, 0);
  }
}

export function sendCommand(eventType: string, payload: Record<string, unknown>): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('[WS] Cannot send - not connected');
    return;
  }
  socket.send(JSON.stringify(createEnvelope(eventType, payload)));
}

export function saveSnapshot(): void {
  sendCommand('snapshot.save', { type: 'saveSnapshot' });
}

export function loadSnapshot(snapshotData: unknown): void {
  sendCommand('snapshot.load', { type: 'loadSnapshot', snapshot: snapshotData });
}

function scheduleReconnect(): void {
  reconnectTimeout = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    connectWebSocket();
  }, reconnectDelay);
}

function handleServerEvent(envelope: Envelope<Record<string, unknown>>): void {
  const { eventType, payload, sequence: inboundSequence } = envelope;

  if (eventType === 'world.bootstrap') {
    resyncInFlight = false;
    if (typeof inboundSequence === 'number') {
      expectedInboundSequence = inboundSequence + 1;
    }
    useWorldStore.getState().setConnectionStatus('stable');
  } else if (typeof inboundSequence === 'number') {
    if (inboundSequence < expectedInboundSequence) {
      return;
    }

    if (inboundSequence > expectedInboundSequence) {
      if (!resyncInFlight) {
        resyncInFlight = true;
        useWorldStore.getState().setConnectionStatus('resyncing');
        sendCommand('request.resync', { type: 'requestResync' });
      }
      return;
    }

    expectedInboundSequence = inboundSequence + 1;
  }

  const store = useWorldStore.getState();

  switch (eventType) {
    case 'world.bootstrap':
    case 'tick.sync':
      store.hydrateFromServer({
        isPlaying: payload.isPlaying as boolean,
        currentTick: payload.currentTick as number,
        awakeAgents: payload.awakeAgents as number,
        totalAgents: payload.totalAgents as number,
        rustRam: payload.rustRam as number,
      });
      break;

    case 'chat.message':
      store.addMessage({
        id: payload.id as string,
        agentId: payload.agentId as string,
        agentName: payload.agentName as string,
        agentRole: payload.agentRole as string,
        agentRoleColor: payload.agentRoleColor as string,
        agentAvatarInitials: payload.agentAvatarInitials as string,
        channelId: payload.channelId as string,
        content: payload.content as string,
        timestamp: payload.timestamp as string,
        tick: payload.tick as number,
        isSystemMessage: (payload.isSystemMessage as boolean) ?? false,
      });
      break;

    case 'chat.batch': {
      const messages = (payload.messages as Array<Record<string, unknown>> | undefined) ?? [];
      store.addMessages(
        messages.map((message) => ({
          id: message.id as string,
          agentId: message.agentId as string,
          agentName: message.agentName as string,
          agentRole: message.agentRole as string,
          agentRoleColor: message.agentRoleColor as string,
          agentAvatarInitials: message.agentAvatarInitials as string,
          channelId: message.channelId as string,
          content: message.content as string,
          timestamp: message.timestamp as string,
          tick: message.tick as number,
          isSystemMessage: (message.isSystemMessage as boolean) ?? false,
        }))
      );
      break;
    }

    case 'graph.snapshot': {
      const graphData = payload.data as Record<string, unknown> | undefined;
      if (!graphData) break;

      store.hydrateGraph({
        nodes: ((graphData.nodes as Array<Record<string, unknown>>) ?? []).map((node) => ({
          id: node.id as string,
          name: node.name as string,
          val: node.val as number,
          group: node.group as string,
          status: node.status as string,
        })),
        links: ((graphData.links as Array<Record<string, unknown>>) ?? []).map((link) => ({
          source: link.source as string,
          target: link.target as string,
        })),
      });
      break;
    }

    case 'agent.detail':
      store.hydrateInspector({
        agentId: payload.agentId as string,
        name: payload.name as string,
        role: payload.role as string,
        roleColor: payload.roleColor as string,
        avatarInitials: payload.avatarInitials as string,
        status: payload.status as string,
        lastTick: (payload.lastTick as number) ?? 0,
        model: payload.model as string,
        tier: payload.tier as string,
        tokensPerTick: payload.tokensPerTick as number,
        tools: (payload.tools as string[]) ?? [],
        thoughtLog: (payload.thoughtLog as string[]) ?? [],
      });
      break;

    case 'agent.status.batch':
      store.applyStatusBatch(
        ((payload.changes as Array<Record<string, unknown>>) ?? []).map((change) => ({
          agentId: change.agentId as string,
          status: change.status as string,
        }))
      );
      break;

    case 'analytics.tick':
      store.appendAnalytics({
        tick: payload.tick as number,
        positive: payload.positive as number,
        negative: payload.negative as number,
        tokens: payload.tokens as number,
        adoption: payload.adoption as number,
        simulatedRevenue: payload.simulatedRevenue as number,
        tickLatencyMs: (payload.tickLatencyMs as number) ?? 0,
        recallLatencyMs: (payload.recallLatencyMs as number) ?? 0,
        wsQueueDepth: (payload.wsQueueDepth as number) ?? 0,
      });
      break;

    case 'seed.applied': {
      const systemMessage = payload.systemMessage as Record<string, unknown> | undefined;
      if (!systemMessage) break;

      store.handleSeedApplied({
        id: systemMessage.id as string,
        agentId: systemMessage.agentId as string,
        agentName: systemMessage.agentName as string,
        agentRole: systemMessage.agentRole as string,
        agentRoleColor: systemMessage.agentRoleColor as string,
        agentAvatarInitials: systemMessage.agentAvatarInitials as string,
        channelId: systemMessage.channelId as string,
        content: systemMessage.content as string,
        timestamp: systemMessage.timestamp as string,
        tick: (systemMessage.tick as number) ?? 0,
        isSystemMessage: true,
      });
      break;
    }

    case 'snapshot.data': {
      const blob = new Blob([JSON.stringify(payload.snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `society-snapshot-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      break;
    }

    case 'genesis.result':
    case 'echo':
      break;

    default:
      console.log('[WS] Unknown event type:', eventType, payload);
  }
}
