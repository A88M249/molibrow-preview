/* Molí Brow Studio – interaction + GSAP motion.
   Content is fully visible without JS; if GSAP fails to load we add .no-gsap and stop. */
(function () {
  var d = document.documentElement, hd = document.getElementById('hd'), nav = document.getElementById('nav'), bg = document.getElementById('bg');
  var solidAlways = hd && hd.hasAttribute('data-solid');

  /* ---- header: solid on scroll, hides on scroll-down, mobile menu ---- */
  var lastY = 0;
  addEventListener('scroll', function () {
    var y = scrollY; if (!hd) return;
    hd.classList.toggle('solid', solidAlways || y > 30);
    hd.classList.toggle('hide', y > lastY && y > 400 && !(nav && nav.classList.contains('open')));
    lastY = y;
  }, { passive: true });

  function menu(open) {
    if (!nav || !bg) return;
    nav.classList.toggle('open', open); bg.setAttribute('aria-expanded', open);
    if (open && window.gsap && !d.classList.contains('no-gsap')) gsap.fromTo('#nav > *', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .06, delay: .15, ease: 'power3.out', clearProps: 'transform,opacity' });
  }
  if (bg) bg.onclick = function () { menu(!nav.classList.contains('open')); };
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a')) menu(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });

  /* ---- GSAP ---- */
  if (!window.gsap || !window.ScrollTrigger) { d.classList.add('no-gsap'); return; }
  gsap.registerPlugin(ScrollTrigger);
  var mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: reduce)', function () { d.classList.add('no-gsap'); });

  mm.add('(prefers-reduced-motion: no-preference)', function () {
    d.classList.remove('no-gsap');
    var ease = 'power3.out', all = function (s, r) { return gsap.utils.toArray(s, r); };

    /* split a heading into words (keeps <em> etc.) so words can slide up from a mask */
    function split(el) {
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.nodeValue.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              var w = document.createElement('span'), wi = document.createElement('span');
              w.className = 'w'; wi.className = 'wi'; wi.textContent = part; w.appendChild(wi); frag.appendChild(w);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1) walk(n);
        });
      })(el);
      el.classList.add('is-split');
      return el.querySelectorAll('.wi');
    }

    /* ---- first-view intro (hero on home, .phero on inner pages) ---- */
    var first = document.querySelector('.hero, .phero');
    var introEls = [];
    if (first) {
      var h1 = first.querySelector('h1');
      var tl = gsap.timeline({ defaults: { ease: ease } });
      if (h1) tl.fromTo(split(h1), { yPercent: 115 }, { yPercent: 0, duration: 1.15, stagger: .07, ease: 'power4.out' }, 0);
      introEls = all('.rv, .eyebrow, .lead, .ctas, .proof, .keyfacts, .crumbs, .btn', first).filter(function (el) { return !el.closest('.frame') && !el.closest('h1'); });
      /* only direct page-intro elements, not nested ones */
      introEls = introEls.filter(function (el) { return !introEls.some(function (o) { return o !== el && o.contains(el); }); });
      tl.fromTo(introEls, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: .95, stagger: .09, clearProps: 'transform' }, .25);
      var frame = first.querySelector('.frame');
      if (frame) {
        var fimg = frame.querySelector('img');
        tl.from(frame, { y: 56, duration: 1.3 }, .1);
        if (fimg) tl.from(fimg, { scale: 1.14, duration: 1.9, ease: 'power2.out' }, .1);
        tl.from(frame.querySelectorAll('.marks i'), { scale: 0, opacity: 0, duration: .6, stagger: .08, ease: 'back.out(2)' }, .9);
      }
    }
    var introSet = new Set(introEls);
    /* anything else with .rv inside the first view (the h1, nested items) is simply shown */
    if (first) all('.rv', first).forEach(function (el) { if (!introSet.has(el)) gsap.set(el, { opacity: 1, y: 0, clearProps: 'transform' }); });

    /* ---- big section headings ---- */
    all('h2').forEach(function (h) {
      if (h.closest('.hero,.phero')) return;
      var words = split(h);
      gsap.fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: .05, ease: 'power4.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });

    /* ---- scroll reveals ---- */
    var rv = all('.rv').filter(function (el) { return !(first && first.contains(el)); });
    ScrollTrigger.batch(rv, {
      start: 'top 90%', once: true,
      onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: .95, stagger: .09, ease: ease, overwrite: true, clearProps: 'transform' }); }
    });

    /* ---- price / FAQ rows ---- */
    var rows = all('.row, details').filter(function (r) { return !r.closest('.rv') && !(first && first.contains(r)); });
    if (rows.length) {
      gsap.set(rows, { opacity: 0, y: 14 });
      ScrollTrigger.batch(rows, { start: 'top 92%', once: true, onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: .7, stagger: .06, ease: ease, clearProps: 'transform' }); } });
    }

    /* ---- parallax: framed prints (subtle) and the wide band (stronger) ---- */
    all('.frame').forEach(function (fr) {
      var im = fr.querySelector('img'); if (!im) return;
      gsap.fromTo(im, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12, ease: 'none', scrollTrigger: { trigger: fr, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    all('.band img').forEach(function (im) {
      gsap.fromTo(im, { yPercent: -9, scale: 1.18 }, { yPercent: 9, scale: 1.18, ease: 'none', scrollTrigger: { trigger: im.closest('.band'), start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* ---- number count-up (5,0 · 91 · 59) ---- */
    all('.big, .proofs b, .proof b').forEach(function (el) {
      var tn = Array.prototype.find.call(el.childNodes, function (n) { return n.nodeType === 3 && /\d/.test(n.nodeValue); });
      if (!tn) return;
      var m = tn.nodeValue.trim().match(/^(\d+)([.,])?(\d+)?$/); if (!m) return;
      var dec = m[3] ? m[3].length : 0, sep = m[2] || ',', end = parseFloat(m[1] + '.' + (m[3] || '0')), o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: function () { tn.nodeValue = o.v.toFixed(dec).replace('.', sep); }, onComplete: function () { tn.nodeValue = m[0]; } });
    });

    addEventListener('load', function () { ScrollTrigger.refresh(); });
    return function () { /* matchMedia cleanup reverts all of the above */ };
  });
})();
