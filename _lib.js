const crypto = require('crypto');

// Turns 01012345678, +201012345678, 00201012345678 into +201012345678.
// Returns null if it is not an Egyptian mobile number.
function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0020')) d = d.slice(4);
  else if (d.startsWith('20') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^1[0125]\d{8}$/.test(d) ? '+20' + d : null;
}

function sign(phone, exp) {
  return crypto.createHmac('sha256', process.env.TOKEN_SECRET).update(phone + '|' + exp).digest('hex');
}
function makeToken(phone) {
  const exp = Date.now() + 30 * 60 * 1000; // valid 30 minutes
  return exp + '.' + sign(phone, exp);
}
function checkToken(phone, token) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(phone, exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

async function twilio(path, params) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, svc = process.env.TWILIO_VERIFY_SERVICE_SID;
  const r = await fetch('https://verify.twilio.com/v2/Services/' + svc + '/' + path, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + tok).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

module.exports = { normPhone, makeToken, checkToken, twilio, body };
