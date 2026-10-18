/* Fills the contact lines on the legal pages from config.js. */
(function () {
  var c = window.ARDUA_CONFIG || {};
  [].slice.call(document.querySelectorAll('[data-contact]')).forEach(function (el) {
    var k = el.getAttribute('data-contact');
    if (k === 'email' && c.contactEmail) { var a = document.createElement('a'); a.href = 'mailto:' + c.contactEmail; a.textContent = c.contactEmail; el.replaceChildren(a); }
    if (k === 'phone' && c.contactPhone) { el.textContent = c.contactPhone; }
    if (k === 'days' && c.damageReportDays) { el.textContent = String(c.damageReportDays); }
  });
})();
