(function () {
  var v = document.getElementById('heroVid'), b = document.getElementById('vidBtn');
  if (!v || !b) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function label() { var p = v.paused; b.textContent = p ? 'Play' : 'Pause'; b.setAttribute('aria-label', p ? 'Play the film' : 'Pause the film'); b.setAttribute('aria-pressed', p ? 'true' : 'false'); }
  b.hidden = false; label();
  if (reduce) { v.removeAttribute('autoplay'); v.pause(); label(); }
  else { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { label(); }); }
  b.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); label(); });
  v.addEventListener('play', label); v.addEventListener('pause', label);
  if ('IntersectionObserver' in window && !reduce) {
    var userPaused = false;
    b.addEventListener('click', function () { userPaused = v.paused; });
    new IntersectionObserver(function (e) { if (e[0].isIntersecting) { if (!userPaused) v.play().catch(function () {}); } else v.pause(); }, { threshold: 0.1 }).observe(v);
  }
})();
