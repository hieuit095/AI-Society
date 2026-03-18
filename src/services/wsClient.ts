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
        useWorldStore.getState().setConnectionStatus('stable');
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
        useWorldStore.getState().setConnectionStatus('degraded');
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

/**
 * Request a snapshot save of the current simulation state.
 * The server will respond with a `snapshotData` event containing the full state.
 */
export function saveSnapshot(): void {
    sendCommand('clientCommand', { type: 'saveSnapshot' });
}

/**
 * Load a previously saved snapshot, restoring the simulation to that state.
 */
export function loadSnapshot(snapshotData: unknown): void {
    sendCommand('clientCommand', { type: 'loadSnapshot', snapshot: snapshotData });
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

    // ── worldBootstrap is always accepted unconditionally ──
    // It resets the sequence counter and clears any in-flight resync.
    if (type === 'worldBootstrap') {
        resyncInFlight = false;
        if (inboundSeq) {
            expectedInboundSequence = inboundSeq + 1;
        }
        // Connection fully recovered — clear any degradation warning
        useWorldStore.getState().setConnectionStatus('stable');
        // Fall through to process the event below.
    } else if (inboundSeq) {
        // ── Sequence gap detection ──
        if (inboundSeq > expectedInboundSequence) {
            if (!resyncInFlight) {
                console.warn(
                    `[WS] Sequence gap: expected ${expectedInboundSequence}, got ${inboundSeq}. Dropping payload and requesting resync.`
                );
                resyncInFlight = true;
                useWorldStore.getState().setConnectionStatus('resyncing');
                sendCommand('clientCommand', { type: 'requestResync' });
            }
            // DROP this payload — wait for the resync bootstrap.
            return;
        }
        // Monotonic advancement — only on sequential messages.
        expectedInboundSequence = inboundSeq + 1;
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
                channelId: payload.channelId as string,
                content: payload.content as string,
                timestamp: payload.timestamp as string,
                tick: payload.tick as number,
                isSystemMessage: (payload.isSystemMessage as boolean) ?? false,
            });
            break;

        case 'chatBatch': {
            const messages = payload.messages as Array<Record<string, unknown>>;
            if (messages && messages.length > 0) {
                store.addMessages(
                    messages.map((m) => ({
                        id: m.id as string,
                        agentId: m.agentId as string,
                        agentName: m.agentName as string,
                        agentRole: m.agentRole as string,
                        agentRoleColor: m.agentRoleColor as string,
                        agentAvatarInitials: m.agentAvatarInitials as string,
                        channelId: m.channelId as string,
                        content: m.content as string,
                        timestamp: m.timestamp as string,
                        tick: m.tick as number,
                        isSystemMessage: (m.isSystemMessage as boolean) ?? false,
                    }))
                );
            }
            break;
        }

        case 'graphSnapshot': {
            // Server nests graph data under `payload.data` per events.rs GraphSnapshot { data }
            const graphData = payload.data as Record<string, unknown> | undefined;
            if (graphData) {
                const nodes = graphData.nodes as Array<{
                    id: string; name: string; val: number; group: string; status: string;
                }>;
                const links = graphData.links as Array<{ source: string; target: string }>;
                if (nodes && links) {
                    store.hydrateGraph({ nodes, links });
                }
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
                simulatedRevenue: payload.simulatedRevenue as number,
                tickLatencyMs: (payload.tickLatencyMs as number) ?? 0,
                recallLatencyMs: (payload.recallLatencyMs as number) ?? 0,
                wsQueueDepth: (payload.wsQueueDepth as number) ?? 0,
            });
            break;

        case 'seedApplied': {
            console.log('[WS] Seed applied:', payload.seedId, payload.title);
            // Server nests the system message under `payload.systemMessage` per events.rs SeedApplied
            const sysMsg = payload.systemMessage as Record<string, unknown> | undefined;
            if (sysMsg) {
                store.handleSeedApplied({
                    id: sysMsg.id as string,
                    agentId: sysMsg.agentId as string,
                    agentName: sysMsg.agentName as string,
                    agentRole: sysMsg.agentRole as string,
                    agentRoleColor: sysMsg.agentRoleColor as string,
                    agentAvatarInitials: sysMsg.agentAvatarInitials as string,
                    channelId: (sysMsg.channelId as string) ?? 'board-room',
                    content: sysMsg.content as string,
                    timestamp: sysMsg.timestamp as string,
                    tick: (sysMsg.tick as number) ?? 0,
                    isSystemMessage: true,
                });
            } else {
                console.warn('[WS] seedApplied event missing systemMessage payload');
            }
            break;
        }

        case 'genesisResult':
            console.log(
                `[WS] 🧬 Genesis: ${payload.spawnedCount} agents spawned (${payload.eliteCount} Elite, ${payload.citizenCount} Citizen). Total: ${payload.newTotal}`
            );
            // The server also broadcasts tickSync + graphSnapshot,
            // so totalAgents/graph will auto-update via those handlers.
            break;

        case 'echo':
            console.log('[WS] Echo:', payload.message);
            break;

        case 'snapshotData': {
            console.log('[WS] Snapshot received, triggering download');
            const blob = new Blob(
                [JSON.stringify(payload.snapshot, null, 2)],
                { type: 'application/json' }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `society-snapshot-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            break;
        }

        default:
            console.log('[WS] Unknown event type:', type, payload);
    }
}

