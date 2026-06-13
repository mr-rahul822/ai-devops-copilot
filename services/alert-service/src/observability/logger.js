// ═══════════════════════════════════════════════════════════════════════
// Structured JSON Logger — Node.js Services
// ═══════════════════════════════════════════════════════════════════════
// Uses pino for structured JSON logging compatible with Loki/Promtail.
// Falls back to console-based JSON if pino is not installed.
// ═══════════════════════════════════════════════════════════════════════

const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown';

let logger;

try {
  const pino = require('pino');

  logger = pino({
    base: { service: SERVICE_NAME },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label.toUpperCase() };
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  });
} catch {
  // Fallback: structured JSON via console
  const makeLogger = (level) => (...args) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const entry = {
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      level: level.toUpperCase(),
      message: msg,
    };
    console.log(JSON.stringify(entry));
  };

  logger = {
    info: makeLogger('info'),
    warn: makeLogger('warn'),
    error: makeLogger('error'),
    debug: makeLogger('debug'),
    fatal: makeLogger('fatal'),
    child: (bindings) => {
      // Return a logger that includes bindings in every message
      const childMakeLogger = (level) => (...args) => {
        const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        const entry = {
          timestamp: new Date().toISOString(),
          service: SERVICE_NAME,
          level: level.toUpperCase(),
          message: msg,
          ...bindings,
        };
        console.log(JSON.stringify(entry));
      };
      return {
        info: childMakeLogger('info'),
        warn: childMakeLogger('warn'),
        error: childMakeLogger('error'),
        debug: childMakeLogger('debug'),
        fatal: childMakeLogger('fatal'),
      };
    },
  };
}

/**
 * Create a child logger with request context (trace_id, user_id).
 * Usage: const reqLogger = contextLogger({ trace_id: '...', user_id: '...' });
 */
function contextLogger(context = {}) {
  return logger.child(context);
}

module.exports = { logger, contextLogger };
