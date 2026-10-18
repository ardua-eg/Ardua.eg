const { normPhone, makeToken, twilio, body } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = body(req), phone = normPhone(b.phone), code = String(b.code || '').replace(/\D/g, '');
  if (!phone || code.length < 4 || code.length > 8) return res.status(400).json({ error: 'bad_input' });
  try {
    const r = await twilio('VerificationCheck', { To: phone, Code: code });
    if (r.ok && r.body.status === 'approved') return res.status(200).json({ ok: true, token: makeToken(phone) });
    return res.status(400).json({ error: 'wrong_code' });
  } catch (e) { return res.status(502).json({ error: 'check_failed' }); }
};
