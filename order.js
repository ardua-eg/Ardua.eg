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


// Server-side prices so nobody can change the total from the browser.
const CATALOG = { structured: { name: 'ARDUA Structured Cap', price: 250 } };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  try {
    const b = body(req);
    const no = clean(b.order_number, 20).toUpperCase();
    if (!/^ARD-\d{6}$/.test(no)) return res.status(400).json({ ok: false, error: 'order number' });
    if (await limited('ardua:rl:order:' + ip(req), 12, 3600)) return res.status(429).json({ ok: false, error: 'slow down' });

    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20).map((l) => {
      const p = CATALOG[clean(l.id, 40)];
      const qty = Math.max(1, Math.min(10, parseInt(l.qty, 10) || 0));
      return p && qty ? { id: clean(l.id, 40), name: p.name, size: clean(l.size, 20) || 'One size', qty, price: p.price } : null;
    }).filter(Boolean);
    if (!items.length) return res.status(400).json({ ok: false, error: 'items' });

    const name = clean(b.name, 80), phone = clean(b.phone, 25);
    if (!name || phone.replace(/\D/g, '').length < 8) return res.status(400).json({ ok: false, error: 'contact' });

    const total = items.reduce((n, i) => n + i.price * i.qty, 0);
    const now = new Date().toISOString();
    const order = {
      id: no, no, status: 'pending', createdAt: now, updatedAt: now, statusAt: now,
      name, phone, email: clean(b.email, 120),
      items, itemsText: items.map((i) => i.qty + ' x ' + i.name + ' (' + i.size + ')').join('\n'), total,
      gov: clean(b.gov, 60), city: clean(b.city, 80), street: clean(b.street, 160),
      building: clean(b.building, 40), floor: clean(b.floor, 20), apt: clean(b.apt, 20), landmark: clean(b.landmark, 160),
      fee: null, notes: ''
    };

    const added = await redis(['HSETNX', HASH, no, JSON.stringify(order)]);
    if (added === 0) return res.status(409).json({ ok: false, error: 'duplicate' });

    // Phone notification (optional): set NTFY_TOPIC in Vercel.
    const topic = process.env.NTFY_TOPIC;
    if (topic) {
      try {
        await fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
          method: 'POST',
          headers: { Title: 'New ARDUA order ' + no, Priority: 'high', Tags: 'shopping_cart', Click: 'https://ardua.shop/admin/' },
          body: total + ' EGP - ' + name + ' - ' + order.city + ', ' + order.gov
        });
      } catch (e) { /* the order is saved; ignore notification failure */ }
    }
    return res.status(200).json({ ok: true, order: no });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'server' });
  }
};
