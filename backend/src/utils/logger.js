/**
 * Minimal structured logger.
 *
 * Goals:
 *   - Single import surface (`logger.info`, `.warn`, `.error`, `.debug`) so we
 *     can swap to pino/winston later without touching call sites.
 *   - Always include a `module` tag so log lines tell you who emitted them.
 *   - In production: machine-parseable single-line JSON; in development:
 *     human-friendly with module + level prefix.
 *   - Error helper that captures stack + cause without callers having to
 *     remember `err.stack`.
 *
 * Usage:
 *   const log = require('../utils/logger').child('storage');
 *   log.info('uploaded', { key, size });
 *   log.error('upload failed', err, { key });
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const CURRENT_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;
const PROD = process.env.NODE_ENV === 'production';

function formatLine(level, mod, msg, meta) {
  const ts = new Date().toISOString();
  if (PROD) {
    return JSON.stringify({ ts, level, module: mod, msg, ...(meta || {}) });
  }
  const tag = `[${ts}] ${level.toUpperCase().padEnd(5)} ${mod}:`;
  const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${tag} ${msg}${extra}`;
}

function emit(level, mod, msg, meta) {
  if (LEVELS[level] < CURRENT_LEVEL) return;
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(formatLine(level, mod, msg, meta));
}

// Build a child logger pinned to a module name. Pass the module name once
// at the top of a file: `const log = require('../utils/logger').child('foo');`
function child(mod) {
  return {
    debug: (msg, meta) => emit('debug', mod, msg, meta),
    info:  (msg, meta) => emit('info',  mod, msg, meta),
    warn:  (msg, meta) => emit('warn',  mod, msg, meta),
    // Error helper: accept an Error as the 2nd arg and unpack its message +
    // stack + code into the meta so call sites don't need to remember the
    // boilerplate. Additional context can be passed as the 3rd arg.
    error: (msg, errOrMeta, meta) => {
      const err = errOrMeta instanceof Error ? errOrMeta : null;
      const extra = err
        ? {
            err: {
              message: err.message,
              name: err.name,
              code: err.code,
              ...(err.statusCode ? { statusCode: err.statusCode } : {}),
              ...(PROD ? {} : { stack: err.stack })
            },
            ...(meta || {})
          }
        : (errOrMeta || {});
      emit('error', mod, msg, extra);
    }
  };
}

module.exports = {
  child,
  // Bare exports for one-off uses outside a module context. Prefer child().
  debug: (msg, meta) => emit('debug', 'app', msg, meta),
  info:  (msg, meta) => emit('info',  'app', msg, meta),
  warn:  (msg, meta) => emit('warn',  'app', msg, meta),
  error: (msg, err, meta) => child('app').error(msg, err, meta)
};
