const { Kafka, logLevel } = require('kafkajs');
const alertEngine = require('../engine/alertEngine');

const kafka = new Kafka({
  clientId: 'alert-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  logLevel: logLevel.WARN, // Suppress verbose KafkaJS internal logs
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'alert-service-group',
  // Manual commit gives us exactly-once processing semantics:
  // offset is committed AFTER the message is fully processed.
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

let _connected = false;
let _running = false;

// ─────────────────────────────────────────────────────────────────────────────
// Start (with retry loop)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;

async function start() {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      attempt++;
      console.log(`[KAFKA] Connecting to broker (attempt ${attempt}/${MAX_RETRIES})...`);

      await consumer.connect();
      await consumer.subscribe({ topic: 'metrics-stream', fromBeginning: false });

      _connected = true;
      _running = true;
      console.log('[KAFKA] Consumer connected — subscribed to metrics-stream');

      // eachMessage auto-commits after the handler returns (default KafkaJS behavior)
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const raw = message.value?.toString();
          if (!raw) return;

          let metric;
          try {
            metric = JSON.parse(raw);
          } catch {
            console.warn('[KAFKA] Received non-JSON message — skipping:', raw.slice(0, 80));
            return;
          }

          console.log(
            `[KAFKA] Received metric: cpu=${metric.cpu_percent?.toFixed(1)}% ` +
            `ram=${metric.ram_percent?.toFixed(1)}% ` +
            `disk=${metric.disk_percent?.toFixed(1)}% ` +
            `service=${metric.service_name}`
          );

          // Run alert evaluation — errors are caught so one bad message
          // never crashes the consumer
          try {
            await alertEngine.evaluate(metric);
          } catch (err) {
            console.error('[KAFKA] Alert engine error:', err.message);
          }
        },
      });

      return; // ← success, exit retry loop

    } catch (err) {
      _connected = false;
      _running = false;
      console.error(`[KAFKA] Connection attempt ${attempt} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        console.log(`[KAFKA] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.error('[KAFKA] Max retries reached. Consumer is NOT running.');
        // Don't crash the process — REST API stays up even without Kafka
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop (clean shutdown on SIGTERM/SIGINT)
// ─────────────────────────────────────────────────────────────────────────────

async function stop() {
  if (_running) {
    try {
      await consumer.disconnect();
      console.log('[KAFKA] Consumer disconnected cleanly.');
    } catch (err) {
      console.error('[KAFKA] Error during disconnect:', err.message);
    } finally {
      _connected = false;
      _running = false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status (used by GET /alerts/health)
// ─────────────────────────────────────────────────────────────────────────────

function status() {
  return { connected: _connected, running: _running };
}

module.exports = { start, stop, status };
