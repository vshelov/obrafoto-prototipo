(function () {
  // Revelado al hacer scroll
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  // Pasos con celular fijo
  var phone = document.getElementById('phone');
  var steps = document.querySelectorAll('.step');
  var so = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        steps.forEach(function (s) { s.classList.remove('active'); });
        e.target.classList.add('active');
        phone.setAttribute('data-step', e.target.getAttribute('data-step'));
      }
    });
  }, { rootMargin: window.innerWidth <= 860 ? '-72% 0px -24% 0px' : '-45% 0px -45% 0px', threshold: 0 });
  steps.forEach(function (s) { so.observe(s); });

  // Control interactivo de validación
  var r = document.getElementById('valr'), n = document.getElementById('valn');
  if (r && n) r.addEventListener('input', function () { n.textContent = r.value; });

  // Contadores de metas
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var co = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      co.unobserve(e.target);
      var el = e.target, end = +el.dataset.count, pre = el.dataset.pre || '', suf = el.dataset.suf || '';
      if (reduce) return;
      var t0 = null;
      function tick(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 1200, 1), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
        el.textContent = pre.replace('&lt;', '<') + v + suf;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(function (el) { co.observe(el); });
})();
