/**
 * @file stress_tester.js
 * @description Headless WebSocket stress tester for ZeroClaw AI Society.
 * Connects to the Rust backend, injects a "Black Swan" seed scenario,
 * counts 50 tick.sync events, then reports results and exits.
 *
 * Usage: node scripts/stress_tester.js
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:4000/ws';
const TARGET_TICKS = 50;
let outboundSeq = 0;

function createEnvelope(eventType, payload) {
    outboundSeq += 1;
    return JSON.stringify({
        schemaVersion: 1,
        worldId: 'default',
        sequence: outboundSeq,
        sentAt: new Date().toISOString(),
        eventType,
        payload,
    });
}

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  ZEROCLAW AI SOCIETY — BLACK SWAN STRESS TESTER     ║');
console.log('║  Target: 1000 Agents × 50 Ticks                    ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log();
console.log(`[TESTER] Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);
let tickCount = 0;
let bootstrapReceived = false;
const tickTimestamps = [];

ws.on('open', () => {
    console.log('[TESTER] Connected to Rust backend');
    console.log('[TESTER] Waiting for world.bootstrap...');
});

ws.on('message', (data) => {
    try {
        const envelope = JSON.parse(data.toString());
        const payload = envelope.payload;
        const type = payload?.type;

        // Wait for bootstrap before injecting seed
        if (!bootstrapReceived && type === 'worldBootstrap') {
            bootstrapReceived = true;
            console.log(
                `[TESTER] Bootstrap received: ${payload.totalAgents} agents, tick ${payload.currentTick}`
            );
            console.log('[TESTER] Injecting Black Swan seed...');
            ws.send(
                createEnvelope('injectSeed', {
                    type: 'injectSeed',
                    title: 'Global AGI Network Outage',
                    audience: 'Entire Society',
                    context:
                        'The central cloud infrastructure has collapsed. Elite agents are disconnected. Citizens must aggressively route around the failure using local mesh networks.',
                })
            );

            // Wait 500ms for seed to apply, then send play
            setTimeout(() => {
                console.log('[TESTER] Sending PLAY command...');
                ws.send(
                    createEnvelope('simulationControl', {
                        type: 'simulationControl',
                        action: 'play',
                    })
                );
                console.log('[TESTER] Counting tick.sync events...');
                console.log();
            }, 500);
            return;
        }

        // Count tick.sync events
        if (type === 'tickSync') {
            tickCount++;
            tickTimestamps.push({
                tick: payload.currentTick,
                awake: payload.awakeAgents,
                total: payload.totalAgents,
                ram: payload.rustRam,
                receivedAt: Date.now(),
            });

            // Progress indicator every 10 ticks
            if (tickCount % 10 === 0 || tickCount === 1) {
                console.log(
                    `[TESTER] Tick ${tickCount}/${TARGET_TICKS} | T${payload.currentTick} | Awake: ${payload.awakeAgents}/${payload.totalAgents} | RAM: ${payload.rustRam}MB`
                );
            }

            if (tickCount >= TARGET_TICKS) {
                console.log();
                console.log('╔══════════════════════════════════════════════════════╗');
                console.log('║  STRESS TEST COMPLETE — 50 TICKS RECEIVED           ║');
                console.log('╚══════════════════════════════════════════════════════╝');
                console.log();

                // Calculate inter-tick intervals
                const intervals = [];
                for (let i = 1; i < tickTimestamps.length; i++) {
                    intervals.push(
                        tickTimestamps[i].receivedAt - tickTimestamps[i - 1].receivedAt
                    );
                }

                if (intervals.length > 0) {
                    const avg = Math.round(
                        intervals.reduce((a, b) => a + b, 0) / intervals.length
                    );
                    const sorted = [...intervals].sort((a, b) => a - b);
                    const min = sorted[0];
                    const max = sorted[sorted.length - 1];
                    const p99 = sorted[Math.floor(sorted.length * 0.99)];
                    const slipped = intervals.filter((i) => i > 1500).length;

                    console.log('CLIENT-SIDE INTER-TICK INTERVALS:');
                    console.log(`   Average: ${avg}ms`);
                    console.log(`   Min:     ${min}ms`);
                    console.log(`   Max:     ${max}ms`);
                    console.log(`   P99:     ${p99}ms`);
                    console.log(`   Slipped (>1500ms): ${slipped}/${intervals.length}`);
                    console.log();
                    console.log(
                        `   Final RAM: ${tickTimestamps[tickTimestamps.length - 1].ram}MB`
                    );
                    console.log(
                        `   Final Awake: ${tickTimestamps[tickTimestamps.length - 1].awake}/${tickTimestamps[tickTimestamps.length - 1].total}`
                    );
                }

                ws.close();
                process.exit(0);
            }
        }
    } catch (e) {
        // Ignore parse errors
    }
});

ws.on('error', (err) => {
    console.error(`[TESTER] WebSocket error: ${err.message}`);
    process.exit(1);
});

ws.on('close', () => {
    if (tickCount < TARGET_TICKS) {
        console.error(
            `[TESTER] Connection closed before reaching ${TARGET_TICKS} ticks (got ${tickCount})`
        );
        process.exit(1);
    }
});

// Safety timeout — 120 seconds max
setTimeout(() => {
    console.error(`[TESTER] TIMEOUT: Got ${tickCount}/${TARGET_TICKS} ticks in 120 seconds`);
    ws.close();
    process.exit(1);
}, 120_000);
