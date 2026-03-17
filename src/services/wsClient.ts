/**
 * @file wsClient.ts
 * @description WebSocket client service that connects to the Rust society-server.
 * @ai_context This is the bridge between the Rust backend and the React frontend.
 *             It handles connection lifecycle, message routing, and Zustand hydration.
 */

import { useWorldStore } from '../store/useWorldStore';

// ── Configuration ──
const WS_URL = 'ws://localhost:4000/ws';
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = RECONNECT_DELAY_MS;

/**
 * Envelope shape matching the Rust `Envelope<T>` struct.
 * Used to wrap all outbound messages.
 */
interface Envelope<T> {
    schemaVersion: number;
    worldId: string;
    sequence: number;
    sentAt: string;
    eventType: string;
    payload: T;
}

/** Outbound command sequence counter */
let outboundSequence = 0;

/** Expected inbound sequence for gap detection */
let expectedInboundSequence = 1;
let resyncInFlight = false;

/**
 * Creates a versioned envelope matching the Rust `Envelope<T>` wire format.
 */
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

/**
 * Connect to the Rust WebSocket server.
 * Automatically reconnects with exponential backoff on disconnection.
 */
export function connectWebSocket(): void {
    if (socket?.readyState === WebSocket.OPEN) return;

    console.log(`[WS] Connecting to ${WS_URL}...`);
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.log('[WS] Connected');
        reconnectDelay = RECONNECT_DELAY_MS; // Reset backoff on successful connect
    };

    socket.onmessage = (event) => {
        try {
            const envelope = JSON.parse(event.data);
            handleServerEvent(envelope);
        } catch (e) {
            console.warn('[WS] Failed to parse message:', e);
        }
    };

    socket.onclose = () => {
        console.log(`[WS] Disconnected. Reconnecting in ${reconnectDelay}ms...`);
        socket = null;
        scheduleReconnect();
    };

    socket.onerror = (err) => {
        console.warn('[WS] Error:', err);
        socket?.close();
    };
}

/**
 * Disconnect from the WebSocket server.
 */
export function disconnectWebSocket(): void {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    if (socket) {
        socket.onclose = null; // Prevent reconnect
        socket.close();
        socket = null;
    }
}

/**
 * Send a typed command to the Rust server via the versioned envelope protocol.
 */
export function sendCommand(eventType: string, payload: Record<string, unknown>): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('[WS] Cannot send — not connected');
        return;
    }
    const envelope = createEnvelope(eventType, payload);
    socket.send(JSON.stringify(envelope));
}

// ── Internal helpers ──

function scheduleReconnect(): void {
    reconnectTimeout = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
        connectWebSocket();
    }, reconnectDelay);
}

/**
 * Route incoming server events to the appropriate Zustand store actions.
 */
function handleServerEvent(envelope: Envelope<Record<string, unknown>>): void {
    const { payload, sequence: inboundSeq } = envelope;
    const type = payload?.type as string;

    // ── Sequence gap detection ──
    if (inboundSeq && inboundSeq > expectedInboundSequence && !resyncInFlight) {
        console.warn(`[WS] Sequence gap detected: expected ${expectedInboundSequence}, got ${inboundSeq}. Requesting resync.`);
        resyncInFlight = true;
        sendCommand('clientCommand', { type: 'requestResync' });
    }
    if (inboundSeq) {
        expectedInboundSequence = inboundSeq + 1;
    }
    if (type === 'worldBootstrap') {
        resyncInFlight = false;
    }

    const store = useWorldStore.getState();

    switch (type) {
        case 'worldBootstrap':
            console.log('[WS] World bootstrap received:', payload);
            store.hydrateFromServer({
                isPlaying: payload.isPlaying as boolean,
                currentTick: payload.currentTick as number,
                awakeAgents: payload.awakeAgents as number,
                totalAgents: payload.totalAgents as number,
                rustRam: payload.rustRam as number,
            });
            break;

        case 'tickSync':
            store.hydrateFromServer({
                isPlaying: payload.isPlaying as boolean,
                currentTick: payload.currentTick as number,
                awakeAgents: payload.awakeAgents as number,
                totalAgents: payload.totalAgents as number,
                rustRam: payload.rustRam as number,
            });
            break;

        case 'chatMessage':
            store.addMessage({
                id: payload.id as string,
                agentId: payload.agentId as string,
                agentName: payload.agentName as string,
                agentRole: payload.agentRole as string,
                agentRoleColor: payload.agentRoleColor as string,
                agentAvatarInitials: payload.agentAvatarInitials as string,
                content: payload.content as string,
                timestamp: payload.timestamp as string,
                tick: payload.tick as number,
                isSystemMessage: (payload.isSystemMessage as boolean) ?? false,
            });
            break;

        case 'graphSnapshot': {
            const nodes = payload.nodes as Array<{
                id: string; name: string; val: number; group: string; status: string;
            }>;
            const links = payload.links as Array<{ source: string; target: string }>;
            if (nodes && links) {
                store.hydrateGraph({ nodes, links });
            }
            break;
        }

        case 'agentDetail':
            store.hydrateInspector({
                agentId: payload.agentId as string,
                name: payload.name as string,
                role: payload.role as string,
                roleColor: payload.roleColor as string,
                avatarInitials: payload.avatarInitials as string,
                status: payload.status as string,
                model: payload.model as string,
                tier: payload.tier as string,
                tokensPerTick: payload.tokensPerTick as number,
                tools: payload.tools as string[],
                thoughtLog: payload.thoughtLog as string[],
            });
            break;

        case 'agentStatusBatch':
            store.applyStatusBatch(
                (payload.changes as Array<{ agentId: string; status: string }>) ?? []
            );
            break;

        case 'analyticsTick':
            store.appendAnalytics({
                tick: payload.tick as number,
                positive: payload.positive as number,
                negative: payload.negative as number,
                tokens: payload.tokens as number,
                adoption: payload.adoption as number,
            });
            break;

        case 'seedApplied':
            console.log('[WS] Seed applied:', payload.seedId, payload.title);
            store.handleSeedApplied({
                id: payload.id as string,
                agentId: payload.agentId as string,
                agentName: payload.agentName as string,
                agentRole: payload.agentRole as string,
                agentRoleColor: payload.agentRoleColor as string,
                agentAvatarInitials: payload.agentAvatarInitials as string,
                content: payload.content as string,
                timestamp: payload.timestamp as string,
                tick: 0,
                isSystemMessage: true,
            });
            break;

        case 'echo':
            console.log('[WS] Echo:', payload.message);
            break;

        default:
            console.log('[WS] Unknown event type:', type, payload);
    }
}

