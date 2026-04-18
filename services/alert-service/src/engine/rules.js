/**
 * alert-service/src/engine/rules.js
 *
 * Defines all threshold-based alert rules evaluated per Kafka message.
 * Each rule object describes ONE metric check that the alert engine runs.
 *
 * Fields:
 *   alertType          — unique string key, stored in DB + used for cooldown lookup
 *   severity           — CRITICAL | HIGH | MEDIUM | LOW
 *   field              — which metric field to check (must match Kafka message keys)
 *   threshold          — value that triggers the alert when exceeded
 *   consecutiveRequired — how many consecutive breaching readings must occur before firing
 *   cooldownMinutes    — minimum minutes between two alerts of this type for same service
 *   message(value, service) — function returning the alert message string
 */

const RULES = [
  {
    alertType: 'CPU_SPIKE',
    severity: 'HIGH',
    field: 'cpu_percent',
    threshold: 85,
    consecutiveRequired: 3,
    cooldownMinutes: 10,
    message: (value, service) =>
      `CPU usage at ${value}% for 3 consecutive readings on ${service}`,
  },
  {
    alertType: 'RAM_CRITICAL',
    severity: 'CRITICAL',
    field: 'ram_percent',
    threshold: 90,
    consecutiveRequired: 1,
    cooldownMinutes: 5,
    message: (value, service) =>
      `RAM usage critical at ${value}% on ${service}`,
  },
  {
    alertType: 'DISK_WARNING',
    severity: 'MEDIUM',
    field: 'disk_percent',
    threshold: 80,
    consecutiveRequired: 1,
    cooldownMinutes: 30,
    message: (value, service) =>
      `Disk usage at ${value}% on ${service}`,
  },
];

module.exports = RULES;
