const { normPhone, twilio, body } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const phone = normPhone(body(req).phone);
  if (!phone) return res.status(400).json({ error: 'bad_phone' });
  try {
    const r = await twilio('Verifications', { To: phone, Channel: 'sms' });
    if (r.status === 429) return res.status(429).json({ error: 'too_many' });
    if (!r.ok) return res.status(502).json({ error: 'sms_failed' });
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(502).json({ error: 'sms_failed' }); }
};
