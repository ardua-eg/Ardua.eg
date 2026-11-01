(function () {
'use strict';
var KEY = 'ardua.admin.pw';
var STATUS = [['pending', 'Pending'], ['confirmed', 'Confirmed'], ['shipped', 'Shipped'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
var NEXT = { pending: ['confirmed', 'Confirm order'], confirmed: ['shipped', 'Mark shipped'], shipped: ['completed', 'Mark completed'] };
var S = { pw: '', orders: [], filter: 'all', q: '', seen: null, fresh: {}, confirmDel: null, busy: {} };
var timer, toastT;

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function money(n) { return Math.round(Number(n) || 0).toLocaleString('en-US') + ' EGP'; }
function label(k) { for (var i = 0; i < STATUS.length; i++) if (STATUS[i][0] === k) return STATUS[i][1]; return k; }
function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600); }
function when(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function wa(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('0020') === 0) d = d.slice(2); if (d.charAt(0) === '0') d = '20' + d.slice(1); return d.length >= 11 ? d : ''; }
function store(v) { try { if (v == null) sessionStorage.removeItem(KEY); else sessionStorage.setItem(KEY, v); } catch (e) { } }
function recall() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

function api(method, data) {
  return fetch('/api/admin', { method: method, headers: { 'Authorization': 'Bearer ' + S.pw, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined, cache: 'no-store' })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); });
}
function showLogin(msg) {
  $('app').hidden = true; $('login').hidden = false; clearInterval(timer);
  var e = $('loginErr'); e.textContent = msg || ''; e.hidden = !msg; $('pw').focus();
}
function setNotice(m) { var n = $('notice'); n.textContent = m || ''; n.hidden = !m; }

function load(quiet) {
  return api('GET').then(function (j) {
    if (j.status === 401) { store(null); S.pw = ''; showLogin('Wrong password.'); return; }
    if (j.status === 429) { showLogin('Too many tries. Wait a few minutes.'); return; }
    if (!j.ok) { setNotice(j.error === 'ADMIN_PASSWORD is not set' ? 'The dashboard password is not set in Vercel yet.' : 'Could not load orders. Check that the database is connected in Vercel.'); if (!quiet) show(); return; }
    setNotice('');
    var ids = j.orders.map(function (o) { return o.id; });
    if (S.seen) ids.forEach(function (id) { if (S.seen.indexOf(id) < 0) S.fresh[id] = 1; });
    S.seen = ids; S.orders = j.orders; show();
  }, function () { setNotice('No connection. Will retry.'); if (!quiet) show(); });
}
function show() {
  $('login').hidden = true; $('app').hidden = false; render();
  clearInterval(timer); timer = setInterval(function () { if (!document.hidden) load(true); }, 30000);
}

function counts() { var c = { all: S.orders.length }; STATUS.forEach(function (s) { c[s[0]] = 0; }); S.orders.forEach(function (o) { if (c[o.status] != null) c[o.status]++; }); return c; }
function visible() {
  var q = S.q.toLowerCase();
  return S.orders.filter(function (o) {
    if (S.filter !== 'all' && o.status !== S.filter) return false;
    return !q || [o.no, o.name, o.phone, o.city, o.gov, o.email].join(' ').toLowerCase().indexOf(q) > -1;
  });
}
function card(o) {
  var b = !!S.busy[o.id], nx = NEXT[o.status], w = wa(o.phone), id = esc(o.id);
  var addr = [o.street, o.building && 'Building ' + o.building, o.floor && 'Floor ' + o.floor, o.apt && 'Apt ' + o.apt].filter(Boolean).join(', ');
  var opts = STATUS.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === o.status ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('');
  var hasFee = o.fee !== null && o.fee !== undefined && o.fee !== '';
  return '<article class="card' + (S.fresh[o.id] ? ' fresh' : '') + '" data-id="' + id + '" data-status="' + esc(o.status) + '">' +
    '<div class="top"><div><span class="no">' + id + '</span> <span class="when">' + esc(when(o.createdAt)) + '</span></div><span class="pill s-' + esc(o.status) + '">' + esc(label(o.status)) + '</span></div>' +
    '<div class="who"><h3>' + esc(o.name) + '</h3><span class="ph">' + esc(o.phone) + '</span><button class="btn small" type="button" data-act="copy" data-text="' + esc(o.phone) + '">Copy</button>' +
    (w ? '<a class="link" href="https://wa.me/' + w + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</div>' +
    '<div class="cols"><div><span class="mono">Items</span><p>' + esc(o.itemsText) + '</p><p class="total">' + money(o.total) + (hasFee ? ' + ' + money(o.fee) + ' delivery = ' + money(o.total + Number(o.fee)) : '') + '</p></div>' +
    '<div><span class="mono">Deliver to</span><p>' + esc(addr || '-') + '</p><p>' + esc([o.city, o.gov].filter(Boolean).join(', ')) + '</p>' + (o.landmark ? '<p class="when">Near ' + esc(o.landmark) + '</p>' : '') + (o.email ? '<p class="when">' + esc(o.email) + '</p>' : '') + '</div></div>' +
    '<div class="actions">' + (nx ? '<button class="btn primary" type="button" data-act="status" data-to="' + nx[0] + '"' + (b ? ' disabled' : '') + '>' + nx[1] + '</button>' : '') +
    '<select class="in" aria-label="Status of ' + id + '" data-act="select"' + (b ? ' disabled' : '') + '>' + opts + '</select>' +
    (o.status !== 'cancelled' && o.status !== 'completed' ? '<button class="btn" type="button" data-act="status" data-to="cancelled"' + (b ? ' disabled' : '') + '>Cancel order</button>' : '') + '</div>' +
    '<details><summary>Delivery fee, notes, delete</summary><div class="more">' +
    '<div class="field"><label class="mono" for="fee-' + id + '">Delivery fee (EGP)</label><input class="in" id="fee-' + id + '" inputmode="numeric" value="' + esc(hasFee ? o.fee : '') + '" data-act="fee" autocomplete="off"></div>' +
    '<div class="field"><label class="mono" for="note-' + id + '">Notes</label><textarea class="in" id="note-' + id + '" data-act="note">' + esc(o.notes || '') + '</textarea></div>' +
    '<div class="wide"><button class="btn danger small" type="button" data-act="delete">' + (S.confirmDel === o.id ? 'Tap again to delete for good' : 'Delete order') + '</button></div></div></details></article>';
}
function render() {
  var c = counts();
  $('vPending').textContent = c.pending; $('tPending').classList.toggle('hot', c.pending > 0);
  $('vProg').textContent = c.confirmed + c.shipped; $('vDone').textContent = c.completed;
  $('vSales').textContent = money(S.orders.filter(function (o) { return o.status === 'completed'; }).reduce(function (n, o) { return n + (Number(o.total) || 0); }, 0));
  document.title = (c.pending ? '(' + c.pending + ') ' : '') + 'ARDUA Orders';
  $('chips').innerHTML = [['all', 'All']].concat(STATUS).map(function (s) { return '<button class="chip" type="button" data-filter="' + s[0] + '" aria-pressed="' + (S.filter === s[0]) + '">' + s[1] + '<i>' + (c[s[0]] || 0) + '</i></button>'; }).join('');
  var rows = visible();
  $('list').innerHTML = !S.orders.length ? '<div class="empty">No orders yet. New orders appear here by themselves.</div>' : !rows.length ? '<div class="empty">No matches.</div>' : rows.map(card).join('');
}

function update(id, patch, msg) {
  if (S.busy[id]) return; S.busy[id] = 1; render();
  patch.action = 'update'; patch.id = id;
  api('POST', patch).then(function (j) {
    if (j.ok) { for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) S.orders[i] = j.order; if (msg) toast(msg); } else toast('Could not save. Try again.');
  }, function () { toast('No connection.'); }).then(function () { delete S.busy[id]; render(); });
}
$('list').addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (!b) return;
  var c = b.closest('.card'), id = c && c.getAttribute('data-id'), a = b.getAttribute('data-act');
  if (a === 'copy') { var t = b.getAttribute('data-text'); try { navigator.clipboard.writeText(t).then(function () { toast('Copied'); }, function () { toast(t); }); } catch (x) { toast(t); } }
  else if (a === 'status') update(id, { status: b.getAttribute('data-to') }, 'Marked ' + label(b.getAttribute('data-to')).toLowerCase());
  else if (a === 'delete') {
    if (S.confirmDel !== id) { S.confirmDel = id; render(); setTimeout(function () { if (S.confirmDel === id) { S.confirmDel = null; render(); } }, 4000); return; }
    S.confirmDel = null;
    api('POST', { action: 'delete', id: id }).then(function (j) { if (j.ok) { S.orders = S.orders.filter(function (o) { return o.id !== id; }); toast('Order deleted'); render(); } else toast('Could not delete.'); });
  }
});
$('list').addEventListener('change', function (e) {
  var t = e.target, c = t.closest('.card'); if (!c) return;
  var id = c.getAttribute('data-id'), a = t.getAttribute('data-act');
  if (a === 'select') update(id, { status: t.value }, 'Marked ' + label(t.value).toLowerCase());
  if (a === 'fee') { var v = t.value.replace(/[^\d.]/g, ''); update(id, { fee: v === '' ? null : Number(v) }, 'Delivery fee saved'); }
  if (a === 'note') update(id, { notes: t.value }, 'Note saved');
});
$('chips').addEventListener('click', function (e) { var b = e.target.closest('[data-filter]'); if (b) { S.filter = b.getAttribute('data-filter'); render(); } });
$('q').addEventListener('input', function (e) { S.q = e.target.value.trim(); render(); });
$('refresh').addEventListener('click', function () { S.fresh = {}; load(); toast('Updated'); });
$('logout').addEventListener('click', function () { store(null); S.pw = ''; S.orders = []; S.seen = null; $('pw').value = ''; showLogin(''); });
$('loginForm').addEventListener('submit', function (e) {
  e.preventDefault(); var v = $('pw').value; if (!v) return;
  S.pw = v; store(v); load();
});
function cell(s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
$('exportBtn').addEventListener('click', function () {
  var head = ['Order', 'Status', 'Created', 'Name', 'Phone', 'Email', 'Items', 'Items total', 'Delivery fee', 'Governorate', 'City', 'Street', 'Building', 'Floor', 'Apartment', 'Landmark', 'Notes'];
  var rows = S.orders.map(function (o) { return [o.no, o.status, o.createdAt, o.name, o.phone, o.email, o.itemsText, o.total, o.fee, o.gov, o.city, o.street, o.building, o.floor, o.apt, o.landmark, o.notes]; });
  var csv = '﻿' + [head].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'ardua-orders.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
});

S.pw = recall();
if (S.pw) load(); else showLogin('');
})();
