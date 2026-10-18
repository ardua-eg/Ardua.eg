(function () {
'use strict';

var CFG = window.ARDUA_CONFIG || {};
var MAX_QTY = 10;
var CART_KEY = 'ardua.cart.v1';

/* ---------- catalog ---------- */
var PRODUCTS = [
  { id: 'trucker', name: 'ARDUA Trucker', cat: 'trucker', catLabel: 'Trucker', price: 500,
    short: 'Black front, mesh back, raised white mark.',
    desc: 'A five-panel trucker with a clean black front and a breathable mesh back. The ARDUA mark is embroidered in dense white thread on the front panel. Curved visor, snapback at the rear.',
    specs: [['Style', 'Five-panel trucker'], ['Front', 'Black twill, embroidered mark'], ['Back', 'Black mesh, snapback'], ['Visor', 'Curved, stitched rows'], ['Fit', 'One size']],
    sizes: ['One size'],
    images: [['trucker.jpg', 'ARDUA trucker cap in black with a white embroidered mark, three-quarter view'], ['trucker-dark.jpg', 'ARDUA trucker cap lit from behind in dark smoke'], ['detail.jpg', 'Close-up of the white embroidered mark']] },
  { id: 'structured', name: 'ARDUA Structured Cap', cat: 'structured', catLabel: 'Structured', price: 550,
    short: 'A firm crown that holds its shape.',
    desc: 'A structured six-panel cap with a firm crown and a curved visor sewn with concentric rows of stitching. The white ARDUA mark is raised from the black twill, and stitched eyelets on the panels let heat out.',
    specs: [['Style', 'Six-panel, structured'], ['Fabric', 'Black twill'], ['Panels', 'Stitched eyelets'], ['Visor', 'Curved, stitched rows'], ['Fit', 'One size']],
    sizes: ['One size'],
    images: [['structured.jpg', 'ARDUA structured cap in black on a dark plinth'], ['detail.jpg', 'Close-up of the white embroidered mark'], ['wordmark.jpg', 'ARDUA wordmark embroidered on black fabric']] }
];
var CATS = [['all', 'All'], ['trucker', 'Trucker'], ['structured', 'Structured']];

var state = { cat: 'all', q: '', sort: 'featured', cart: [] };
var cur = null;

/* ---------- helpers ---------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function fmt(n) { return Math.round(n).toLocaleString('en-US') + ' EGP'; }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function byId(id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; }

/* ---------- cart state ---------- */
function loadCart() {
  try {
    var r = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (Array.isArray(r)) {
      state.cart = r.filter(function (l) { var p = l && byId(l.id); return p && p.sizes.indexOf(l.size) > -1 && typeof l.qty === 'number' && l.qty > 0; })
        .map(function (l) { return { id: l.id, size: l.size, qty: Math.min(MAX_QTY, Math.floor(l.qty)) }; });
    }
  } catch (e) { /* storage unavailable: cart lives in memory only */ }
}
function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) { /* ignore */ } }
function lineKey(l) { return l.id + '|' + l.size; }
function findLine(id, size) { return state.cart.filter(function (l) { return l.id === id && l.size === size; })[0]; }
function addToCart(id, size, qty) {
  var l = findLine(id, size);
  if (l) { l.qty = Math.min(MAX_QTY, l.qty + qty); } else { state.cart.push({ id: id, size: size, qty: Math.min(MAX_QTY, qty) }); }
  saveCart(); renderCart();
}
function cartCount() { return state.cart.reduce(function (n, l) { return n + l.qty; }, 0); }
function subtotal() { return state.cart.reduce(function (n, l) { return n + byId(l.id).price * l.qty; }, 0); }

/* ---------- dialogs ---------- */
function openDlg(id) {
  var d = document.getElementById(id);
  if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  document.body.classList.add('lock');
  return d;
}
$$('dialog').forEach(function (d) {
  d.addEventListener('close', function () { if (!document.querySelector('dialog[open]')) document.body.classList.remove('lock'); });
  d.addEventListener('click', function (e) {
    if (e.target === d) { d.close(); return; }
    var c = e.target.closest('[data-close]');
    if (c && d.contains(c)) d.close();
  });
});

/* ---------- toast ---------- */
var toastTimer = null;
function toast(msg, withCart) {
  $('#toastMsg').textContent = msg;
  $('#cartStatus').textContent = msg + ' ' + cartCount() + (cartCount() === 1 ? ' item' : ' items') + ' in your cart.';
  $('#toastCart').hidden = !withCart;
  var t = $('#toast'); t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4500);
}
$('#toastCart').addEventListener('click', function () { $('#toast').classList.remove('show'); openDlg('cart'); });

/* ---------- catalog ---------- */
function renderChips() {
  $('#chips').innerHTML = CATS.map(function (c) {
    return '<button type="button" class="chip" data-cat="' + c[0] + '" aria-pressed="' + (state.cat === c[0]) + '">' + c[1] + '</button>';
  }).join('');
}
function filtered() {
  var q = state.q.trim().toLowerCase();
  var list = PRODUCTS.filter(function (p) {
    if (state.cat !== 'all' && p.cat !== state.cat) return false;
    if (!q) return true;
    return (p.name + ' ' + p.catLabel + ' ' + p.short + ' ' + p.desc).toLowerCase().indexOf(q) > -1;
  });
  if (state.sort === 'low') list.sort(function (a, b) { return a.price - b.price; });
  else if (state.sort === 'high') list.sort(function (a, b) { return b.price - a.price; });
  else if (state.sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return list;
}
function cardHTML(p) {
  return '<article class="card">' +
    '<button class="media" type="button" data-open="' + p.id + '" aria-label="View details for ' + esc(p.name) + '">' +
    '<img src="' + p.images[0][0] + '" alt="' + esc(p.images[0][1]) + '" width="1254" height="627" loading="lazy"></button>' +
    '<div class="body"><span class="mono">' + esc(p.catLabel) + '</span>' +
    '<h3>' + esc(p.name) + '</h3><p class="short">' + esc(p.short) + '</p>' +
    '<div class="row"><span class="price">' + fmt(p.price) + '</span>' +
    '<button class="btn small" type="button" data-quick="' + p.id + '" aria-label="Add ' + esc(p.name) + ' to cart">Add to cart</button></div></div></article>';
}
function renderGrid() {
  var list = filtered();
  $('#grid').innerHTML = list.map(cardHTML).join('');
  $('#empty').hidden = list.length > 0;
  $('#resultCount').textContent = list.length + (list.length === 1 ? ' cap shown' : ' caps shown');
}
$('#chips').addEventListener('click', function (e) {
  var b = e.target.closest('[data-cat]'); if (!b) return;
  state.cat = b.getAttribute('data-cat'); renderChips(); renderGrid();
  var again = $('[data-cat="' + state.cat + '"]'); if (again) again.focus();
});
$('#search').addEventListener('input', function (e) { state.q = e.target.value; renderGrid(); });
$('#sort').addEventListener('change', function (e) { state.sort = e.target.value; renderGrid(); });
$('#clearFilters').addEventListener('click', function () {
  state.cat = 'all'; state.q = ''; state.sort = 'featured';
  $('#search').value = ''; $('#sort').value = 'featured'; renderChips(); renderGrid(); $('#search').focus();
});
$('#grid').addEventListener('click', function (e) {
  var o = e.target.closest('[data-open]');
  if (o) { openProduct(o.getAttribute('data-open')); return; }
  var q = e.target.closest('[data-quick]');
  if (q) { var p = byId(q.getAttribute('data-quick')); addToCart(p.id, p.sizes[0], 1); toast(p.name + ' added to your cart.', true); }
});

/* ---------- product dialog ---------- */
function openProduct(id) {
  var p = byId(id);
  cur = { id: id, size: p.sizes[0], qty: 1 };
  var thumbs = p.images.map(function (im, i) {
    return '<button type="button" data-thumb="' + i + '" aria-label="Show photo ' + (i + 1) + ' of ' + p.images.length + '" aria-current="' + (i === 0) + '"><img src="' + im[0] + '" alt="" width="1254" height="627"></button>';
  }).join('');
  var specs = p.specs.map(function (s) { return '<div><dt class="mono">' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('');
  $('#pvBody').innerHTML =
    '<div class="pv"><div class="pv-media"><div class="pv-main"><img id="pvMain" src="' + p.images[0][0] + '" alt="' + esc(p.images[0][1]) + '" width="1254" height="627"></div><div class="thumbs">' + thumbs + '</div></div>' +
    '<div class="pv-info"><span class="mono">' + esc(p.catLabel) + '</span>' +
    '<h2 class="display" id="pvTitle">' + esc(p.name) + '</h2>' +
    '<p class="price">' + fmt(p.price) + '</p><p class="desc">' + esc(p.desc) + '</p>' +
    '<p><span class="mono">Size</span><br>' + esc(p.sizes[0]) + ', adjustable</p>' +
    '<div class="buy"><div class="stepper" role="group" aria-label="Quantity"><button type="button" data-qty="-1" aria-label="Decrease quantity">&minus;</button><output id="pvQty" aria-live="polite">1</output><button type="button" data-qty="1" aria-label="Increase quantity">+</button></div>' +
    '<button class="btn" type="button" id="pvAdd">Add to cart</button></div>' +
    '<dl class="specs">' + specs + '</dl></div></div>';
  openDlg('product');
}
$('#pvBody').addEventListener('click', function (e) {
  if (!cur) return;
  var p = byId(cur.id);
  var t = e.target.closest('[data-thumb]');
  if (t) {
    var i = +t.getAttribute('data-thumb');
    var m = $('#pvMain'); m.src = p.images[i][0]; m.alt = p.images[i][1];
    $$('[data-thumb]').forEach(function (b) { b.setAttribute('aria-current', String(b === t)); });
    return;
  }
  var q = e.target.closest('[data-qty]');
  if (q) { cur.qty = Math.max(1, Math.min(MAX_QTY, cur.qty + (+q.getAttribute('data-qty')))); $('#pvQty').textContent = cur.qty; return; }
  if (e.target.closest('#pvAdd')) {
    addToCart(cur.id, cur.size, cur.qty);
    $('#product').close();
    openDlg('cart');
  }
});

/* ---------- cart ---------- */
function renderCart() {
  var n = cartCount();
  var badge = $('#cartCount'); badge.textContent = n; badge.setAttribute('data-zero', String(n === 0));
  $('#cartLabel').textContent = n === 0 ? ', empty' : ', ' + n + (n === 1 ? ' item' : ' items');
  var body = $('#cartBody'), foot = $('#cartFoot');
  if (!state.cart.length) {
    body.innerHTML = '<div class="dr-empty"><p>Your cart is empty.</p><button class="btn" type="button" data-close>Shop caps</button></div>';
    foot.hidden = true; return;
  }
  foot.hidden = false;
  var lines = state.cart.map(function (l) {
    var p = byId(l.id), k = esc(lineKey(l));
    return '<div class="line"><img src="' + p.images[0][0] + '" alt="" width="1254" height="627">' +
      '<div><h3>' + esc(p.name) + '</h3><span class="mono">' + esc(l.size) + '</span>' +
      '<div class="meta"><div class="stepper" role="group" aria-label="Quantity of ' + esc(p.name) + '"><button type="button" data-act="dec" data-key="' + k + '" aria-label="Decrease quantity of ' + esc(p.name) + '">&minus;</button><output>' + l.qty + '</output><button type="button" data-act="inc" data-key="' + k + '" aria-label="Increase quantity of ' + esc(p.name) + '">+</button></div>' +
      '<button class="link" type="button" data-act="rm" data-key="' + k + '" aria-label="Remove ' + esc(p.name) + ' from cart">Remove</button></div></div>' +
      '<span class="price">' + fmt(p.price * l.qty) + '</span></div>';
  }).join('');
  body.innerHTML = lines;
  foot.innerHTML =
    '<div class="totals"><div class="grand"><span>Items total</span><span>' + fmt(subtotal()) + '</span></div></div>' +
    '<p class="hint-t">Delivery fee is confirmed with you after you order.</p>' +
    '<button class="btn block" type="button" id="goCheckout">Checkout</button>';
}
$('#cartBody').addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (!b) return;
  var key = b.getAttribute('data-key'), act = b.getAttribute('data-act');
  var l = state.cart.filter(function (x) { return lineKey(x) === key; })[0]; if (!l) return;
  if (act === 'inc') l.qty = Math.min(MAX_QTY, l.qty + 1);
  else if (act === 'dec') l.qty = l.qty - 1;
  else l.qty = 0;
  state.cart = state.cart.filter(function (x) { return x.qty > 0; });
  saveCart(); renderCart();
  var again = $('#cartBody [data-act="' + act + '"][data-key="' + key + '"]') || $('#cartBody [data-act]') || $('#cartBody [data-close]');
  if (again) again.focus();
});
$('#cartFoot').addEventListener('click', function (e) {
  if (e.target.closest('#goCheckout')) { $('#cart').close(); openCheckout(); }
});
$('#openCart').addEventListener('click', function () { openDlg('cart'); });

/* ---------- checkout ---------- */
var FIELDS = [
  { id: 'coName', label: 'Full name', req: true, type: 'text', auto: 'name', msg: 'Enter your full name.' },
  { id: 'coPhone', label: 'Phone number', req: true, type: 'tel', auto: 'tel', inputmode: 'tel', hint: 'We call you on this number to confirm delivery.', msg: 'Enter a phone number with at least 8 digits.' },
  { id: 'coEmail', label: 'Email (optional)', req: false, type: 'email', auto: 'email', inputmode: 'email', msg: 'Enter a valid email address, or leave this empty.' },
  { id: 'coAddr', label: 'Street address', req: true, type: 'text', auto: 'street-address', hint: 'Building, street and area.', msg: 'Enter your street address.' },
  { id: 'coCity', label: 'City or governorate', req: true, type: 'text', auto: 'address-level2', msg: 'Enter your city or governorate.' }
];
function fieldHTML(f) {
  var hid = f.id + '-hint', eid = f.id + '-err';
  return '<div class="fld"><label for="' + f.id + '">' + f.label + '</label>' +
    '<input class="field-in" id="' + f.id + '" name="' + f.id + '" type="' + f.type + '" autocomplete="' + f.auto + '"' +
    (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + (f.req ? ' required' : '') +
    ' aria-describedby="' + (f.hint ? hid + ' ' : '') + eid + '">' +
    (f.hint ? '<p class="hint-t" id="' + hid + '">' + f.hint + '</p>' : '') +
    '<p class="field-err" id="' + eid + '" hidden></p></div>';
}
function summaryHTML() {
  var lines = state.cart.map(function (l) {
    var p = byId(l.id);
    return '<div class="sum-line"><img src="' + p.images[0][0] + '" alt="" width="1254" height="627"><div><b>' + esc(p.name) + '</b><small>' + esc(l.size) + ' &times; ' + l.qty + '</small></div><span class="price">' + fmt(p.price * l.qty) + '</span></div>';
  }).join('');
  return '<h3 class="mono">Order summary</h3><div>' + lines + '</div>' +
    '<div class="totals"><div><span>Items total</span><span>' + fmt(subtotal()) + '</span></div>' +
    '<div><span>Delivery</span><span>Confirmed after you order</span></div>' +
    '<div class="grand"><span>Pay on delivery</span><span>' + fmt(subtotal()) + ' + delivery</span></div></div>' +
    '<p class="hint-t">Payment is cash on delivery. You pay the courier when your order arrives.</p>';
}
function openCheckout() {
  if (!state.cart.length) return;
  $('#coBody').innerHTML =
    '<div class="co"><form id="coForm" novalidate>' +
    '<h2 id="coTitle">Checkout</h2>' +
    '<p class="intro">We only ask for what we need to deliver your order. See our <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.</p>' +
    '<div class="err-sum" id="coErrors" role="alert" tabindex="-1" hidden></div>' +
    '<fieldset><legend>Your details</legend>' + FIELDS.map(fieldHTML).join('') + '</fieldset>' +
    '<div class="off" aria-hidden="true"><label for="coTrap">Leave this empty</label><input id="coTrap" name="_gotcha" type="text" tabindex="-1" autocomplete="off"></div>' +
    '<fieldset><legend>Consent</legend>' +
    '<div class="opt check" id="coConsentBox"><input type="checkbox" id="coConsent" name="consent" aria-describedby="coConsent-err" required>' +
    '<div class="t"><label for="coConsent">I agree to the <a href="terms.html" target="_blank" rel="noopener">terms</a>, the <a href="refunds.html" target="_blank" rel="noopener">refund policy</a> and the <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>. I agree that ARDUA uses my details to deliver this order.</label>' +
    '<p class="field-err" id="coConsent-err" hidden></p></div></div></fieldset>' +
    '<p class="hint-t">Payment: cash on delivery.</p>' +
    '<button class="btn block" type="submit" id="placeOrder">Place order</button>' +
    '</form><aside id="coSummary">' + summaryHTML() + '</aside></div>';
  openDlg('checkout');
}
function setErr(id, msg) {
  var input = document.getElementById(id), err = document.getElementById(id + '-err');
  if (!input || !err) return;
  if (msg) { err.textContent = msg; err.hidden = false; input.setAttribute('aria-invalid', 'true'); }
  else { err.textContent = ''; err.hidden = true; input.removeAttribute('aria-invalid'); }
  if (id === 'coConsent') $('#coConsentBox').setAttribute('data-invalid', msg ? 'true' : 'false');
}
function validate() {
  var errs = [];
  FIELDS.forEach(function (f) {
    var v = document.getElementById(f.id).value.trim(), bad = false;
    if (f.req && !v) bad = true;
    else if (f.id === 'coPhone' && v && v.replace(/\D/g, '').length < 8) bad = true;
    else if (f.id === 'coEmail' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) bad = true;
    if (bad) errs.push({ id: f.id, msg: f.msg, label: f.label.replace(' (optional)', '') }); setErr(f.id, bad ? f.msg : '');
  });
  if (!$('#coConsent').checked) { errs.push({ id: 'coConsent', msg: 'Tick the box to agree before you place your order.', label: 'Consent' }); setErr('coConsent', 'Tick the box to agree before you place your order.'); }
  else setErr('coConsent', '');
  return errs;
}
function showSummary(errs) {
  var box = $('#coErrors');
  if (!errs.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.innerHTML = '<h3>Please fix ' + errs.length + (errs.length === 1 ? ' thing' : ' things') + '</h3><ul>' +
    errs.map(function (e) { return '<li><a href="#' + e.id + '" data-jump="' + e.id + '">' + esc(e.label) + ': ' + esc(e.msg) + '</a></li>'; }).join('') + '</ul>';
  box.hidden = false; box.focus();
}
$('#coBody').addEventListener('click', function (e) {
  var j = e.target.closest('[data-jump]');
  if (j) { e.preventDefault(); var t = document.getElementById(j.getAttribute('data-jump')); if (t) t.focus(); }
});
$('#coBody').addEventListener('input', function (e) {
  if (e.target.id && document.getElementById(e.target.id + '-err') && e.target.getAttribute('aria-invalid') === 'true') setErr(e.target.id, '');
});
$('#coBody').addEventListener('change', function (e) { if (e.target.id === 'coConsent' && e.target.checked) setErr('coConsent', ''); });

function showFormMsg(msg) { var box = $('#coErrors'); box.innerHTML = '<h3>Your order was not sent</h3><p>' + esc(msg) + '</p>'; box.hidden = false; box.focus(); }

$('#coBody').addEventListener('submit', function (e) {
  if (e.target.id !== 'coForm') return;
  e.preventDefault();
  if (!state.cart.length) return;
  var errs = validate();
  showSummary(errs);
  if (errs.length) return;
  if (!CFG.orderEndpoint) { showFormMsg('Ordering is not set up yet. Please try again later.'); return; }
  if ($('#coTrap').value) return;

  var total = subtotal(), count = cartCount();
  var no = 'ARD-' + String(Math.floor(100000 + Math.random() * 900000));
  var v = function (id) { return document.getElementById(id).value.trim(); };
  var items = state.cart.map(function (l) { var p = byId(l.id); return l.qty + ' x ' + p.name + ' (' + l.size + ') = ' + fmt(p.price * l.qty); }).join('\n');
  var details = ['ORDER ' + no, '', 'ITEMS', items, '', 'Items total: ' + fmt(total), 'Delivery fee: to be confirmed with the customer', 'Payment: Cash on delivery', '',
    'CUSTOMER', v('coName'), 'Phone: ' + v('coPhone')].concat(v('coEmail') ? ['Email: ' + v('coEmail')] : [])
    .concat(['', 'DELIVERY ADDRESS', v('coAddr'), v('coCity'), '', 'Consent: agreed to terms, refund policy and privacy policy at ' + new Date().toISOString()]).join('\n');
  var payload = { _subject: 'New ARDUA order ' + no, order_number: no, name: v('coName'), phone: v('coPhone'), order_details: details, total: fmt(total) };
  if (v('coEmail')) payload.email = v('coEmail');

  var btn = $('#placeOrder'); btn.disabled = true; btn.textContent = 'Sending...';
  var name = v('coName'), phone = v('coPhone');
  fetch(CFG.orderEndpoint, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(function (r) { if (!r.ok) throw new Error('send failed'); })
    .then(function () {
      state.cart = []; saveCart(); renderCart();
      $('#coBody').innerHTML = '<div class="done"><span class="mono">Order received</span><h2 class="display" id="coTitle" tabindex="-1"></h2><p id="doneText"></p><div class="ordno" id="doneNo"></div><button class="btn" type="button" data-close>Back to the shop</button></div>';
      $('#coTitle').textContent = 'Thanks, ' + name.split(' ')[0] + '.';
      $('#doneText').textContent = count + (count === 1 ? ' cap' : ' caps') + ' for ' + fmt(total) + ' plus delivery. We will call you on ' + phone + ' to confirm the delivery fee and arrival date. You pay the courier in cash on delivery.';
      $('#doneNo').textContent = no;
      $('#coTitle').focus();
      $('#checkout').scrollTop = 0;
    })
    .catch(function () {
      btn.disabled = false; btn.textContent = 'Place order';
      showFormMsg('We could not reach the order service. Check your connection and try again. Your cart is still saved.');
    });
});

/* ---------- init ---------- */
loadCart(); renderChips(); renderGrid(); renderCart();
})();
