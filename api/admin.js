'use strict';
// Tiny Upstash Redis REST client (no npm packages needed).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  if (!URL_ || !TOKEN) throw new Error('Database is not connected');
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}
function ip(req) {
  return String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'x').trim();
}
// Returns true when the caller is over the limit.
async function limited(key, max, seconds) {
  try {
    const n = await redis(['INCR', key]);
    if (n === 1) await redis(['EXPIRE', key, seconds]);
    return n > max;
  } catch (e) { return false; }
}
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 200); }

const HASH = 'ardua:orders';

const crypto = require('crypto');

const STATUSES = ['pending', 'confirmed', 'shipped', 'completed', 'cancelled'];

function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(503).json({ ok: false, error: 'ADMIN_PASSWORD is not set' });
  try {
    const key = ip(req);
    if (await limited('ardua:rl:admin:' + key, 40, 900)) return res.status(429).json({ ok: false, error: 'too many tries' });
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!auth || !same(auth, pass)) return res.status(401).json({ ok: false, error: 'wrong password' });

    if (req.method === 'GET') {
      const flat = (await redis(['HGETALL', HASH])) || [];
      const orders = [];
      for (let i = 1; i < flat.length; i += 2) { try { orders.push(JSON.parse(flat[i])); } catch (e) { /* skip */ } }
      orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return res.status(200).json({ ok: true, orders });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false });

    const b = body(req);
    const id = clean(b.id, 20).toUpperCase();
    if (!/^ARD-\d{6}$/.test(id)) return res.status(400).json({ ok: false, error: 'id' });
    if (b.action === 'delete') { await redis(['HDEL', HASH, id]); return res.status(200).json({ ok: true }); }
    if (b.action !== 'update') return res.status(400).json({ ok: false, error: 'action' });

    const raw = await redis(['HGET', HASH, id]);
    if (!raw) return res.status(404).json({ ok: false, error: 'not found' });
    const o = JSON.parse(raw), now = new Date().toISOString();
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return res.status(400).json({ ok: false, error: 'status' });
      if (b.status !== o.status) { o.status = b.status; o.statusAt = now; }
    }
    if (b.fee !== undefined) { const f = b.fee === null || b.fee === '' ? null : Number(b.fee); o.fee = f !== null && isFinite(f) && f >= 0 ? f : null; }
    if (b.notes !== undefined) o.notes = clean(b.notes, 1000);
    o.updatedAt = now;
    await redis(['HSET', HASH, id, JSON.stringify(o)]);
    return res.status(200).json({ ok: true, order: o });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'server' });
  }
};
