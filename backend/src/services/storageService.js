/**
 * MinIO-backed object storage.
 *
 * All user-uploaded artefacts (profile images, session files / images / PDFs)
 * live in a single MinIO bucket. We never write to local disk anymore; this
 * module is the single choke point and call sites only see opaque keys +
 * helper URLs.
 *
 * Why MinIO and not local fs:
 *   - The API server is horizontally scaled. Anything written to a local
 *     volume is invisible to peers and lost on restart.
 *   - We need pre-signed URLs for mobile/web clients to download privately
 *     without re-streaming through the API.
 *
 * Configuration: see `.env.example` (MINIO_*). If the MinIO env vars are
 * missing the module disables itself instead of crashing the server — the
 * upload endpoints will surface a clear 503 error instead. This keeps local
 * dev usable without spinning up MinIO for unrelated work.
 */

const path = require('path');
const crypto = require('crypto');
const { Minio } = (() => {
  try {
    return { Minio: require('minio') };
  } catch (e) {
    return { Minio: null };
  }
})();
const logger = require('../utils/logger').child('storage');

const useSSL = String(process.env.MINIO_USE_SSL || 'true').toLowerCase() === 'true';
const config = {
  endPoint: process.env.MINIO_ENDPOINT || '',
  // Port defaults from useSSL (443 vs 80), so callers only need to set
  // MINIO_PORT when they're running on a non-standard one (e.g. local 9000).
  port: parseInt(process.env.MINIO_PORT, 10) || (useSSL ? 443 : 80),
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
  bucket: process.env.MINIO_BUCKET || 'resculance',
  // Optional public base URL for unsigned reads (e.g. when the bucket is
  // policy-public). Defaults to https://<endpoint>/<bucket>/<key>.
  publicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL || null,
  // How long pre-signed GET URLs stay valid. 1 hour balances UX (links
  // survive a typical session) and exposure (links rot from cached pages).
  presignTtlSeconds: parseInt(process.env.MINIO_PRESIGN_TTL_SECONDS, 10) || 3600
};

let _client = null;
let _bucketReady = false;
let _initPromise = null;

function enabled() {
  return !!(Minio && config.endPoint && config.accessKey && config.secretKey);
}

function client() {
  if (!enabled()) return null;
  if (!_client) {
    _client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    });
  }
  return _client;
}

// Ensure the bucket exists. Idempotent and memoised so we don't hit the API
// on every upload. Safe to call concurrently from many requests.
async function ensureBucket() {
  if (!enabled()) {
    logger.warn('MinIO not configured — uploads will be rejected', {
      missing: !config.endPoint ? 'MINIO_ENDPOINT' : !config.accessKey ? 'MINIO_ACCESS_KEY' : !config.secretKey ? 'MINIO_SECRET_KEY' : 'minio-sdk'
    });
    return false;
  }
  if (_bucketReady) return true;
  if (!_initPromise) {
    _initPromise = (async () => {
      const c = client();
      try {
        const exists = await c.bucketExists(config.bucket);
        if (!exists) {
          await c.makeBucket(config.bucket, 'us-east-1');
          logger.info('created MinIO bucket', { bucket: config.bucket });
        }
        _bucketReady = true;
        return true;
      } catch (err) {
        // Reset so subsequent calls retry rather than reuse a poisoned
        // promise. A common cause is the SDK can't reach the endpoint at
        // boot but recovers later.
        _initPromise = null;
        logger.error('failed to ensure bucket', err, { bucket: config.bucket });
        throw err;
      }
    })();
  }
  return _initPromise;
}

// Build an object key. Folder convention:
//   profiles/<userId>-<ts>-<rand>.<ext>
//   sessions/<sessionId>/<ts>-<rand>-<safeName>
// Random suffix prevents collisions when two clients upload the same
// filename in the same millisecond.
function buildObjectKey(folder, originalName, opts = {}) {
  const ext = path.extname(originalName || '') || '';
  const base = path.basename(originalName || 'file', ext).replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  const fname = opts.prefix
    ? `${opts.prefix}-${ts}-${rand}${ext}`
    : `${ts}-${rand}-${base}${ext.startsWith('.') ? '' : ''}`;
  return `${folder.replace(/\/$/, '')}/${fname}`;
}

function publicUrlFor(key) {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  const scheme = config.useSSL ? 'https' : 'http';
  const portPart = (config.useSSL && config.port === 443) || (!config.useSSL && config.port === 80)
    ? ''
    : `:${config.port}`;
  return `${scheme}://${config.endPoint}${portPart}/${config.bucket}/${key}`;
}

/**
 * Upload a Buffer to MinIO. Returns { key, publicUrl, size, etag }.
 *
 * `folder` is the logical prefix (e.g. `'profiles'`, `'sessions/<id>'`).
 * `originalName` is preserved in the key for human-readable listings.
 */
async function uploadBuffer(folder, originalName, buffer, mimetype, opts = {}) {
  if (!enabled()) {
    const err = new Error('Storage is not configured. Set MINIO_* env vars.');
    err.statusCode = 503;
    throw err;
  }
  await ensureBucket();
  const key = buildObjectKey(folder, originalName, opts);
  const c = client();
  try {
    const result = await c.putObject(config.bucket, key, buffer, buffer.length, {
      'Content-Type': mimetype || 'application/octet-stream',
      // Original filename surfaces in the Content-Disposition on signed
      // downloads, so users see the name they uploaded instead of the key.
      'x-amz-meta-original-name': encodeURIComponent(originalName || '')
    });
    logger.info('uploaded object', { key, size: buffer.length, mimetype });
    return {
      key,
      bucket: config.bucket,
      size: buffer.length,
      mimetype: mimetype || 'application/octet-stream',
      etag: result?.etag || null,
      publicUrl: publicUrlFor(key)
    };
  } catch (err) {
    logger.error('uploadBuffer failed', err, { folder, originalName });
    err.statusCode = err.statusCode || 502;
    throw err;
  }
}

async function deleteObject(key) {
  if (!enabled() || !key) return false;
  try {
    await client().removeObject(config.bucket, key);
    logger.debug('deleted object', { key });
    return true;
  } catch (err) {
    // Object missing is a benign no-op from the caller's POV.
    if (err && (err.code === 'NoSuchKey' || err.code === 'NotFound')) return true;
    logger.warn('deleteObject failed', { key, code: err?.code, msg: err?.message });
    return false;
  }
}

/**
 * Generate a presigned GET URL the client can use to download the file
 * directly from MinIO. `downloadFilename` (optional) sets a friendly name
 * on the Content-Disposition header so browsers save it correctly.
 */
async function presignedDownloadUrl(key, { downloadFilename, ttlSeconds } = {}) {
  if (!enabled() || !key) return null;
  await ensureBucket();
  const ttl = Math.min(Math.max(ttlSeconds || config.presignTtlSeconds, 30), 7 * 24 * 3600);
  const reqHeaders = downloadFilename
    ? { 'response-content-disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"` }
    : undefined;
  try {
    return await client().presignedGetObject(config.bucket, key, ttl, reqHeaders);
  } catch (err) {
    logger.error('presignedDownloadUrl failed', err, { key });
    throw err;
  }
}

/**
 * Stream an object back through the API response (alt to redirecting to a
 * presigned URL — useful when the client can't follow redirects or you want
 * to keep the URL bearer-token gated).
 */
async function streamObject(key, res, { downloadFilename, mimetype } = {}) {
  if (!enabled() || !key) {
    const err = new Error('Storage not configured');
    err.statusCode = 503;
    throw err;
  }
  await ensureBucket();
  const stream = await client().getObject(config.bucket, key);
  if (mimetype) res.setHeader('Content-Type', mimetype);
  if (downloadFilename) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
  }
  stream.on('error', (err) => {
    logger.error('streamObject error', err, { key });
    if (!res.headersSent) res.status(502);
    res.end();
  });
  stream.pipe(res);
}

module.exports = {
  enabled,
  ensureBucket,
  uploadBuffer,
  deleteObject,
  presignedDownloadUrl,
  streamObject,
  publicUrlFor,
  buildObjectKey,
  config: () => ({ ...config, secretKey: undefined, accessKey: config.accessKey ? '***' : '' })
};
