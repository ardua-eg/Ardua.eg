const { normPhone, checkToken, body } = require('./_lib');
// Forwards the order to Formspree only if the phone was verified.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = body(req), phone = normPhone(b.phone);
  if (!phone || !checkToken(phone, b.verify_token)) return res.status(403).json({ error: 'not_verified' });
  delete b.verify_token;
  b.phone = phone + ' (verified by SMS)';
  try {
    const r = await fetch(process.env.ORDER_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    if (!r.ok) return res.status(502).json({ error: 'forward_failed' });
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(502).json({ error: 'forward_failed' }); }
};
