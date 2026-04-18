const RULES = require('./rules');
const alertService = require('../services/alertService');
const notifier = require('../services/notifier');

// ─────────────────────────────────────────────────────────────────────────────
// In-memory state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Consecutive breach counters.
 * Key  : "userId:serviceName:alertType"
 * Value: { count: number, lastValue: number }
 *
 * Survives within a process lifecycle but resets on restart.
 * That's acceptable — the DB cooldown system prevents storm scenarios.
 */
const consecutiveCounters = new Map();

/**
 * Last-seen timestamp per service.
 * Key  : "userId:serviceName"
 * Value: Date
 *
 * Updated every time a metric arrives. Used by checkSilentServices().
 */
const lastSeen = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Core evaluator — called for every Kafka message
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs all threshold rules against one metric reading.
 * Fires an alert (insert + notify) when:
 *   1. The metric value breaches the rule threshold
 *   2. The required number of consecutive breaches has been reached
 *   3. The alert is not in cooldown
 *
 * @param {object} metric  — deserialized JSON from Kafka
 */
async function evaluate(metric) {
  const { user_id, service_name } = metric;

  // Update last-seen tracker (used by the SERVICE_SILENT cron)
  lastSeen.set(`${user_id}:${service_name}`, new Date());

  for (const rule of RULES) {
    const value = metric[rule.field];
    if (typeof value !== 'number') continue; // Guard against malformed messages

    const counterKey = `${user_id}:${service_name}:${rule.alertType}`;

    if (value > rule.threshold) {
      // ── Breach ───────────────────────────────────────────────────────────
      const counter = consecutiveCounters.get(counterKey) || { count: 0, lastValue: 0 };
      counter.count += 1;
      counter.lastValue = value;
      consecutiveCounters.set(counterKey, counter);

      console.log(
        `[ALERT ENGINE] ${rule.alertType} breach #${counter.count}/${rule.consecutiveRequired} ` +
        `(${value.toFixed(1)}% > ${rule.threshold}%) on ${service_name}`
      );

      if (counter.count >= rule.consecutiveRequired) {
        const inCooldown = await alertService.isInCooldown(
          user_id,
          service_name,
          rule.alertType,
          rule.cooldownMinutes
        );

        if (!inCooldown) {
          const alertData = {
            user_id,
            service_name,
            alert_type: rule.alertType,
            severity: rule.severity,
            message: rule.message(value.toFixed(1), service_name),
            metric_value: value,
          };

          const saved = await alertService.fireAlert(alertData);
          await notifier.sendAlert(saved);

          // Reset counter after firing so it doesn't fire again next reading
          consecutiveCounters.set(counterKey, { count: 0, lastValue: 0 });
        } else {
          console.log(
            `[ALERT ENGINE] Cooldown active for ${rule.alertType} on ${service_name} — skipping`
          );
          // Reset counter even during cooldown to avoid stacking
          consecutiveCounters.set(counterKey, { count: 0, lastValue: 0 });
        }
      }
    } else {
      // ── Below threshold — reset consecutive counter ────────────────────
      if (consecutiveCounters.has(counterKey)) {
        consecutiveCounters.delete(counterKey);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule 4 — SERVICE_SILENT (run by node-cron every 2 minutes)
// ─────────────────────────────────────────────────────────────────────────────

const SILENCE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const SILENT_COOLDOWN_MINUTES = 10;

/**
 * Iterates over every known service and fires a CRITICAL alert if no
 * metric has been received in the last 3 minutes.
 *
 * This is intentionally a separate path from the real-time evaluator —
 * absence of messages cannot be detected from inside the consumer.
 */
async function checkSilentServices() {
  const now = Date.now();

  for (const [key, lastTime] of lastSeen.entries()) {
    const elapsed = now - lastTime.getTime();

    if (elapsed >= SILENCE_THRESHOLD_MS) {
      const [user_id, service_name] = key.split(':');

      const inCooldown = await alertService.isInCooldown(
        user_id,
        service_name,
        'SERVICE_SILENT',
        SILENT_COOLDOWN_MINUTES
      );

      if (!inCooldown) {
        const elapsedMinutes = Math.floor(elapsed / 60000);
        const alertData = {
          user_id,
          service_name,
          alert_type: 'SERVICE_SILENT',
          severity: 'CRITICAL',
          message: `No metrics received from ${service_name} for ${elapsedMinutes}+ minutes. Service may be down.`,
          metric_value: null,
        };

        console.log(`[CRON] No metrics from ${service_name} for ${elapsedMinutes} min — firing SERVICE_SILENT alert`);
        const saved = await alertService.fireAlert(alertData);
        await notifier.sendAlert(saved);
      }
    }
  }
}

module.exports = { evaluate, checkSilentServices };
