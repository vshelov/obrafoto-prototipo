(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var clamp = function (v, a, b) { return Math.min(Math.max(v, a === undefined ? 0 : a), b === undefined ? 1 : b); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var root = document.documentElement;

  /* ---------- Títulos divididos en líneas (máscara) ---------- */
  $$('.split').forEach(function (el) {
    var isHero = el.tagName === 'H1';
    el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map(function (line, i) {
      return '<span class="ln"><span class="ln-i" style="transition-delay:' + ((isHero ? .1 : 0) + i * .12).toFixed(2) + 's">' + line.trim() + '</span></span>';
    }).join('');
  });

  /* ---------- Pantalla de carga ---------- */
  var loader = $('loader'), t0 = performance.now(), opened = false;
  function openPage() {
    if (opened) return; opened = true;
    var wait = Math.max(0, 1350 - (performance.now() - t0));
    setTimeout(function () {
      if (loader) loader.classList.add('done');
      setTimeout(function () { document.body.classList.add('loaded'); }, 180);
    }, reduce ? 0 : wait);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(openPage);
  window.addEventListener('load', openPage);
  setTimeout(openPage, 2600);

  /* ---------- Revelado al hacer scroll ---------- */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(function (el) { io.observe(el); });

  /* ---------- Texto palabra a palabra ---------- */
  var words = $('words'), wordEls = [];
  if (words) {
    var hot = { 'roba': 1, 'tiempo': 1, 'al': 1, 'terreno.': 1 }, hotZone = true, html = '';
    words.textContent.trim().split(/\s+/).forEach(function (w) {
      var isHot = hotZone && hot[w];
      if (w === 'terreno.') hotZone = false;
      html += '<span class="w' + (isHot ? ' hot' : '') + '">' + w + '</span> ';
    });
    words.innerHTML = html;
    wordEls = words.querySelectorAll('.w');
  }

  /* ---------- Contador genérico ---------- */
  function countTo(el, from, to, dur, fmt) {
    if (reduce) { el.textContent = fmt(to); return; }
    var s = null;
    (function tick(t) {
      if (!s) s = t;
      var p = Math.min((t - s) / dur, 1);
      el.textContent = fmt(Math.round(lerp(from, to, ease(p))));
      if (p < 1) requestAnimationFrame(tick);
    })(performance.now());
  }

  /* ---------- Historia con celular fijo ---------- */
  var phone = $('phone'), tilt = $('phoneTilt'), glow = $('stageGlow'), ringN = $('ringN');
  var dots = $$('#dots i'), steps = $$('.step');
  var glows = ['rgba(226,6,19,.38)', 'rgba(255,120,90,.30)', 'rgba(226,6,19,.45)', 'rgba(255,255,255,.16)', 'rgba(255,60,80,.38)'];
  var r = $('valr'), n = $('valn'), touched = false, demoDone = false, current = 0;

  function setSlider(v) { r.value = v; n.textContent = v; r.style.setProperty('--v', v + '%'); }

  function sliderDemo() {
    if (reduce || touched || demoDone) return;
    demoDone = true;
    var keys = [68, 77, 63, 68], seg = 700, s = null;
    (function tick(t) {
      if (touched) return;
      if (!s) s = t;
      var e = (t - s) / seg, i = Math.floor(e);
      if (i >= keys.length - 1) { setSlider(68); return; }
      setSlider(Math.round(lerp(keys[i], keys[i + 1], easeIO(e - i))));
      requestAnimationFrame(tick);
    })(performance.now() + 500);
  }

  function setStep(nStep) {
    var prev = current;
    current = nStep;
    phone.setAttribute('data-step', nStep);
    if (tilt) tilt.setAttribute('data-step', nStep);
    if (glow) glow.style.setProperty('--glow', glows[nStep - 1]);
    dots.forEach(function (d, i) { d.classList.toggle('on', i === nStep - 1); });
    steps.forEach(function (s, i) { s.classList.toggle('active', i === nStep - 1); });
    if (prev === 1 && nStep === 2 && !reduce) {
      phone.classList.remove('flashing'); void phone.offsetWidth; phone.classList.add('flashing');
    }
    if (nStep === 3 && ringN) countTo(ringN, 0, 68, 1400, function (v) { return v + '%'; });
    if (nStep === 4 && r) setTimeout(sliderDemo, 350);
  }

  function updateSteps(vh) {
    var line = vh * (window.innerWidth <= 860 ? .74 : .55), act = 1;
    steps.forEach(function (s, i) { if (s.getBoundingClientRect().top < line) act = i + 1; });
    if (act !== current) setStep(act);
  }

  if (r && n) r.addEventListener('input', function () { touched = true; setSlider(r.value); });

  /* ---------- Tarjetas: foco de luz + inclinación 3D ---------- */
  $$('.tile').forEach(function (t) {
    t.addEventListener('pointermove', function (e) {
      var b = t.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      t.style.setProperty('--mx', x + 'px');
      t.style.setProperty('--my', y + 'px');
      if (!finePointer || reduce || !t.classList.contains('in')) return;
      var px = x / b.width - .5, py = y / b.height - .5;
      t.classList.add('tilting');
      t.style.transform = 'perspective(1000px) rotateX(' + (-py * 5).toFixed(2) + 'deg) rotateY(' + (px * 7).toFixed(2) + 'deg) translateY(-4px)';
    });
    t.addEventListener('pointerleave', function () { t.classList.remove('tilting'); t.style.transform = ''; });
  });

  /* ---------- Botones magnéticos ---------- */
  if (finePointer && !reduce) $$('.btn,.nav-cta,.link').forEach(function (b) {
    b.addEventListener('pointermove', function (e) {
      var k = b.getBoundingClientRect();
      b.classList.add('magnet-on');
      b.style.translate = ((e.clientX - k.left - k.width / 2) * .28).toFixed(1) + 'px ' + ((e.clientY - k.top - k.height / 2) * .4).toFixed(1) + 'px';
    });
    b.addEventListener('pointerleave', function () { b.classList.remove('magnet-on'); b.style.translate = '0 0'; });
  });

  /* ---------- Contadores de metas ---------- */
  var co = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      co.unobserve(e.target);
      var el = e.target, pre = el.dataset.pre || '', suf = el.dataset.suf || '';
      countTo(el, 0, +el.dataset.count, 1800, function (v) { return pre + v + suf; });
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(function (el) { co.observe(el); });

  /* ---------- Cinta: duplica pistas para el bucle infinito ---------- */
  var mqRows = [$('mq1'), $('mq2')].filter(Boolean);
  mqRows.forEach(function (row) {
    var tr = row.querySelector('.mq-track'), c = tr.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    row.appendChild(c);
  });

  /* ---------- Scroll suave con inercia (solo mouse/trackpad) ---------- */
  var smooth = { on: finePointer && !reduce, cur: 0, target: 0, active: false };
  if (smooth.on) {
    root.style.scrollBehavior = 'auto';
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented) return;
      e.preventDefault();
      var vh = window.innerHeight, max = root.scrollHeight - vh;
      var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1);
      if (!smooth.active) smooth.cur = smooth.target = window.scrollY;
      smooth.target = clamp(smooth.target + d, 0, max);
      smooth.active = true;
    }, { passive: false });
  }
  function scrollToY(y) {
    if (!smooth.on) { window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); return; }
    if (!smooth.active) smooth.cur = window.scrollY;
    smooth.target = clamp(y, 0, root.scrollHeight - window.innerHeight);
    smooth.active = true;
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1), el = id && $(id);
      if (!el) return;
      e.preventDefault();
      scrollToY(id === 'top' ? 0 : el.getBoundingClientRect().top + window.scrollY);
    });
  });

  /* ---------- Mouse (para inclinar el celular del hero) ---------- */
  var mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  if (finePointer && !reduce) window.addEventListener('pointermove', function (e) {
    mouse.x = e.clientX / window.innerWidth * 2 - 1;
    mouse.y = e.clientY / window.innerHeight * 2 - 1;
  }, { passive: true });

  /* ---------- Render ligado al scroll ---------- */
  var nav = $('nav'), bar = $('progress');
  var hero = document.querySelector('.hero'), heroCopy = $('heroCopy'), device = $('heroDevice');
  var heroGlow = document.querySelector('.hero-glow'), heroList = $('heroList'), toast = $('heroToast');
  var heroRows = heroList ? $$('#heroList .row') : [];
  var floats = [$('f1'), $('f2'), $('f3')];
  var statement = $('statement'), zoom = $('zoom'), zoomText = $('zoomText');
  var marquee = document.querySelector('.marquee');
  var para = $$('[data-speed]');
  var lastY = -1, vel = 0, skew = 0, dirty = true;

  function progressOf(el, vh) {
    var b = el.getBoundingClientRect();
    return clamp(-b.top / (b.height - vh));
  }

  function render() {
    var vh = window.innerHeight, y = window.scrollY, vw = window.innerWidth;
    var max = root.scrollHeight - vh;
    bar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    nav.classList.toggle('scrolled', y > 20);
    updateSteps(vh);
    if (reduce) return;

    // Hero
    if (y < hero.offsetHeight + vh) {
      var p = progressOf(hero, vh), c = clamp(p / .32);
      heroCopy.style.opacity = 1 - c;
      heroCopy.style.transform = 'translate(' + (mouse.sx * -10) + 'px,' + (-p * 180 + mouse.sy * -6) + 'px) scale(' + (1 - .08 * c) + ')';
      var small = vw < 600 ? .82 : 1, t = easeIO(clamp(p / .62)), late = ease(clamp((p - .7) / .3));
      var mx = mouse.sx * (2 + 6 * t), my = mouse.sy * (2 + 5 * t);
      device.style.transform = 'translateY(' + lerp(vh * .52, 0, t) + 'px) rotateX(' + (lerp(34, 0, t) - my) + 'deg) rotateY(' + mx + 'deg) scale(' + (small * lerp(.86, 1, t) * (1 + .05 * late)) + ')';
      heroGlow.style.opacity = (.45 + .55 * t) * (1 - clamp((p - .8) / .2));
      heroGlow.style.transform = 'translate(' + mouse.sx * 30 + 'px,' + mouse.sy * 20 + 'px) scale(' + lerp(.75, 1.15, t) + ')';
      var fill = ease(clamp((p - .38) / .32));
      heroList.style.setProperty('--fill', fill);
      heroRows.forEach(function (row) {
        var w = parseFloat(row.querySelector('i').style.getPropertyValue('--w'));
        row.querySelector('em').textContent = Math.round(w * 100 * fill) + '%';
      });
      if (toast) {
        toast.classList.toggle('show', p > .8);
        toast.parentNode.classList.toggle('notif', p > .8);
      }
      floats.forEach(function (f, i) {
        var k = ease(clamp((p - (.5 + i * .08)) / .2)), side = i === 1 ? 1 : -1, depth = (i + 1) * 9;
        f.style.opacity = k;
        f.style.transform = 'translate(' + (side * 50 * (1 - k) + mouse.sx * depth) + 'px,' + (24 * (1 - k) + mouse.sy * depth) + 'px) scale(' + lerp(.9, 1, k) + ')';
      });
    }

    // Palabra a palabra
    if (statement && wordEls.length) {
      var sp = progressOf(statement, vh), lit = clamp(sp * 1.25 - .05) * wordEls.length;
      for (var i = 0; i < wordEls.length; i++) wordEls[i].style.opacity = .14 + .86 * clamp(lit - i);
    }

    // Cinta: se desplaza con el scroll y se inclina con la velocidad
    if (marquee) {
      var mb = marquee.getBoundingClientRect();
      if (mb.bottom > 0 && mb.top < vh) {
        var off = (mb.top - vh) * .3;
        mqRows[0].style.transform = 'translateX(' + (-600 - off) + 'px) skewX(' + skew + 'deg)';
        if (mqRows[1]) mqRows[1].style.transform = 'translateX(' + (-1000 + off) + 'px) skewX(' + skew + 'deg)';
      }
    }

    // Frase que crece
    if (zoom) {
      var zb = zoom.getBoundingClientRect();
      var zp = clamp((vh - zb.top) / zb.height), zt = ease(clamp((zp - .12) / .48));
      zoomText.style.opacity = zt;
      zoomText.style.transform = 'scale(' + lerp(.5, 1, zt) + ')';
      zoomText.style.filter = zt > .99 ? 'none' : 'blur(' + ((1 - zt) * 14) + 'px)';
    }

    // Parallax
    if (vw > 860) para.forEach(function (el) {
      var b = el.getBoundingClientRect();
      if (b.bottom < -200 || b.top > vh + 200) return;
      el.style.translate = '0 ' + ((b.top + b.height / 2 - vh / 2) * -+el.dataset.speed).toFixed(1) + 'px';
    });
  }

  /* ---------- Bucle principal ---------- */
  function frame() {
    if (smooth.active) {
      smooth.cur += (smooth.target - smooth.cur) * .095;
      if (Math.abs(smooth.target - smooth.cur) < .5) { smooth.cur = smooth.target; smooth.active = false; }
      window.scrollTo(0, smooth.cur);
    }
    var y = window.scrollY;
    vel = lastY < 0 ? 0 : y - lastY;
    var targetSkew = clamp(vel * -.12, -7, 7);
    var skewMoving = Math.abs(targetSkew - skew) > .01;
    skew += (targetSkew - skew) * .12;
    var mdx = mouse.x - mouse.sx, mdy = mouse.y - mouse.sy;
    var mouseMoving = Math.abs(mdx) > .0005 || Math.abs(mdy) > .0005;
    mouse.sx += mdx * .07; mouse.sy += mdy * .07;
    if (y !== lastY || mouseMoving || skewMoving || dirty) { render(); dirty = false; }
    lastY = y;
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', function () { dirty = true; });

  setStep(1);
  if (reduce) {
    floats.forEach(function (f) { f.style.opacity = 1; });
    heroList.style.setProperty('--fill', 1);
  }
  requestAnimationFrame(frame);
})();
