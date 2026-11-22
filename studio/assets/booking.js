/* Molí Brow Studio – native booking page for the Spokes public booking API.
   API (api/src/routes/bbk.ts in the Spokes repo), mounted at {api}/v1/public/bbk:
     GET  /w/:slug/info          -> { name, services:[{code,title,description,price_ore,max_qty}], booking_days, ... }
     GET  /w/:slug/availability  -> { days:{ 'YYYY-MM-DD': 'fullt' | 'stengt' } }  (days not listed are open)
     GET  /w/:slug/dropoff?date= -> { on, slots:[{t,end,free}] }                   (hourly slots only when enabled)
     POST /w/:slug/booking       -> { ok, id, statusUrl }
   If anything is missing (slug, API down) the page shows the Timma fallback instead. */
(function () {
  var root = document.getElementById('book-app'); if (!root) return;
  var cfg; try { cfg = JSON.parse(root.getAttribute('data-config')); } catch (e) { return; }
  var T = cfg.i18n, base = cfg.api + '/v1/public/bbk/w/' + encodeURIComponent(cfg.slug);
  var fb = root.querySelector('.book-fallback');
  function fallback() { root.innerHTML = ''; root.appendChild(fb); fb.hidden = false; }
  if (cfg.provider !== 'spokes' || !cfg.slug) return fallback();

  var st = { services: [], picked: {}, days: {}, maxDays: 56, month: null, date: null, time: null, slotsOn: false, token: '', wid: null };
  var $ = function (h) { var d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var money = function (n) { return Math.round(n) + ' ' + T.from; };
  function json(url, opt) {
    return fetch(url, opt).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) { var e = new Error(b.error || r.status); e.status = r.status; e.body = b; throw e; } return b; }); });
  }
  function anim(el) { if (window.gsap && !document.documentElement.classList.contains('no-gsap')) gsap.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: 'power3.out', clearProps: 'transform' }); }

  /* ---------- load workshop ---------- */
  root.innerHTML = '<p>' + esc(T.loading) + '</p>';
  json(base + '/info').then(function (info) {
    st.services = (info.services || []).filter(function (s) { return s && s.code; });
    st.maxDays = info.booking_days || 56;
    if (!st.services.length) throw new Error('no_services');
    var q = new URLSearchParams(location.search).get(cfg.pre);
    if (q) { var ql = q.toLowerCase(); st.services.forEach(function (s) { if (String(s.code).toLowerCase() === ql || String(s.title).toLowerCase().indexOf(ql) > -1) st.picked[s.code] = 1; }); }
    render();
  }).catch(fallback);

  function total() { return st.services.reduce(function (a, s) { return a + (st.picked[s.code] ? s.price_ore / 100 : 0); }, 0); }
  function chosen() { return st.services.filter(function (s) { return st.picked[s.code]; }); }

  /* ---------- UI ---------- */
  function render() {
    root.innerHTML = '';
    var s1 = $('<section class="bk-step" id="bk1"><h2>1. ' + esc(T.service) + '</h2><div id="bk-list"></div><div class="bk-total"><span></span><b id="bk-sum"></b></div></section>');
    var list = s1.querySelector('#bk-list');
    st.services.forEach(function (s) {
      var row = $('<label class="bk-svc"><input type="checkbox" ' + (st.picked[s.code] ? 'checked' : '') + '><b>' + esc(s.title) + '</b><span class="p">' + money(s.price_ore / 100) + '</span>' + (s.description ? '<small>' + esc(s.description) + '</small>' : '') + '</label>');
      row.querySelector('input').onchange = function (e) { if (e.target.checked) st.picked[s.code] = 1; else delete st.picked[s.code]; sum(); gate(); };
      list.appendChild(row);
    });
    var s2 = $('<section class="bk-step" id="bk2" hidden><h2>2. ' + esc(T.day) + '</h2><div class="cal" id="cal"></div><div id="bk-slots"></div></section>');
    var s3 = $('<section class="bk-step" id="bk3" hidden><h2>3. ' + esc(T.details) + '</h2><div class="bk-sum" id="bk-recap"></div>' +
      '<form class="bk-form" id="bk-form" novalidate>' +
      '<div><label for="f1">' + esc(T.first) + '</label><input id="f1" name="firstName" autocomplete="given-name" required maxlength="80"></div>' +
      '<div><label for="f2">' + esc(T.last) + '</label><input id="f2" name="lastName" autocomplete="family-name" maxlength="80"></div>' +
      '<div><label for="f3">' + esc(T.phone) + '</label><input id="f3" name="phone" type="tel" autocomplete="tel" inputmode="tel"></div>' +
      '<div><label for="f4">' + esc(T.email) + '</label><input id="f4" name="email" type="email" autocomplete="email"></div>' +
      '<div class="full"><label for="f5">' + esc(T.comment) + '</label><textarea id="f5" name="comment" rows="3" maxlength="1000"></textarea></div>' +
      '<label class="bk-terms full"><input type="checkbox" id="f6"><span>' + esc(T.terms) + ' <a href="' + esc(cfg.privacy) + '" target="_blank" rel="noopener">' + esc(T.privacy) + '</a></span></label>' +
      '<div class="full" id="ts"></div></form><p class="bk-err" id="bk-err" role="alert"></p>' +
      '<div class="bk-actions"><button class="btn" id="bk-send" type="button">' + esc(T.send) + ' →</button></div></section>');
    root.appendChild(s1); root.appendChild(s2); root.appendChild(s3);
    s3.querySelector('#bk-send').onclick = submit;
    sum(); gate();
    if (cfg.sitekey) loadTurnstile(s3.querySelector('#ts'));
    anim(s1);
  }
  function sum() { var n = chosen().length; var b = document.getElementById('bk-sum'); if (b) b.textContent = n ? money(total()) : ''; }
  function gate() {
    var has = chosen().length > 0, s2 = document.getElementById('bk2');
    if (has && s2.hidden) { s2.hidden = false; initCal(); anim(s2); }
    if (!has) { s2.hidden = true; document.getElementById('bk3').hidden = true; st.date = null; st.time = null; }
  }

  /* ---------- calendar ---------- */
  function initCal() {
    var t = new Date(); st.today = iso(t); st.month = new Date(t.getFullYear(), t.getMonth(), 1);
    var end = new Date(t); end.setDate(end.getDate() + st.maxDays); st.last = iso(end);
    json(base + '/availability?from=' + st.today + '&to=' + st.last).then(function (a) { st.days = a.days || {}; drawCal(); }).catch(function () { st.days = {}; drawCal(); });
    drawCal();
  }
  function drawCal() {
    var el = document.getElementById('cal'), m = st.month, y = m.getFullYear(), mo = m.getMonth();
    var first = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
    var h = '<div class="cal-h"><button type="button" id="cp" aria-label="' + esc(T.prev) + '">‹</button><b>' + esc(T.month[mo]) + ' ' + y + '</b><button type="button" id="cn" aria-label="' + esc(T.nextm) + '">›</button></div><div class="cal-g">';
    T.dow.forEach(function (d) { h += '<span class="dw">' + esc(d) + '</span>'; });
    for (var i = 0; i < first; i++) h += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var ds = y + '-' + pad(mo + 1) + '-' + pad(d), off = ds < st.today || ds > st.last || st.days[ds];
      h += '<button type="button" data-d="' + ds + '"' + (off ? ' disabled' : '') + (st.date === ds ? ' aria-pressed="true"' : ' aria-pressed="false"') + (st.days[ds] ? ' title="' + esc(st.days[ds] === 'fullt' ? T.full : T.closed) + '"' : '') + '>' + d + '</button>';
    }
    el.innerHTML = h + '</div>';
    var cp = el.querySelector('#cp'), cn = el.querySelector('#cn');
    cp.disabled = new Date(y, mo, 1) <= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    cn.disabled = iso(new Date(y, mo + 1, 1)) > st.last;
    cp.onclick = function () { st.month = new Date(y, mo - 1, 1); drawCal(); };
    cn.onclick = function () { st.month = new Date(y, mo + 1, 1); drawCal(); };
    Array.prototype.forEach.call(el.querySelectorAll('[data-d]'), function (b) { b.onclick = function () { pickDay(b.getAttribute('data-d')); }; });
  }
  function pickDay(ds) {
    st.date = ds; st.time = null; drawCal();
    var box = document.getElementById('bk-slots'); box.innerHTML = '';
    json(base + '/dropoff?date=' + ds).catch(function () { return { on: false }; }).then(function (r) {
      st.slotsOn = !!(r.on && r.slots && r.slots.length);
      if (st.slotsOn) {
        var h = '<h3 style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--latte);font-weight:500;margin:26px 0 0">' + esc(T.time) + '</h3><div class="slots">';
        r.slots.forEach(function (s) { h += '<button type="button" data-t="' + esc(s.t) + '"' + (s.free > 0 ? '' : ' disabled') + ' aria-pressed="false">' + esc(s.t) + '</button>'; });
        box.innerHTML = h + '</div>';
        Array.prototype.forEach.call(box.querySelectorAll('[data-t]'), function (b) { b.onclick = function () { st.time = b.getAttribute('data-t'); Array.prototype.forEach.call(box.querySelectorAll('[data-t]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); step3(); }; });
        anim(box);
      } else { box.innerHTML = '<p class="bk-note">' + esc(T.noslots) + '</p>'; step3(); }
    });
  }
  function step3() {
    var s3 = document.getElementById('bk3'), wasHidden = s3.hidden; s3.hidden = false;
    var dt = new Date(st.date + 'T12:00:00');
    document.getElementById('bk-recap').innerHTML = '<b>' + chosen().map(function (s) { return esc(s.title); }).join(' + ') + '</b><br>' + dt.getDate() + '. ' + esc(T.month[dt.getMonth()]) + ' ' + dt.getFullYear() + (st.time ? ' · ' + esc(st.time) : '') + ' · ' + money(total());
    if (wasHidden) { anim(s3); }
  }

  /* ---------- Turnstile (optional) ---------- */
  function loadTurnstile(host) {
    function mount() { try { window.turnstile.render(host, { sitekey: cfg.sitekey, callback: function (t) { st.token = t; }, 'expired-callback': function () { st.token = ''; }, language: cfg.lang === 'en' ? 'en' : 'nb' }); } catch (e) {} }
    if (window.turnstile) return mount();
    var s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = mount; document.head.appendChild(s);
  }

  /* ---------- submit ---------- */
  function submit() {
    var f = document.getElementById('bk-form'), err = document.getElementById('bk-err'), btn = document.getElementById('bk-send');
    var v = function (n) { return (f.elements[n].value || '').trim(); };
    err.textContent = '';
    if (!v('firstName')) { err.textContent = T.name_err; f.elements.firstName.focus(); return; }
    if (!v('phone') && !v('email')) { err.textContent = T.contact; f.elements.phone.focus(); return; }
    if (!document.getElementById('f6').checked) { err.textContent = T.terms_err; return; }
    var body = { services: chosen().map(function (s) { return { code: s.code, qty: 1 }; }),
      customer: { firstName: v('firstName'), lastName: v('lastName'), phone: v('phone'), email: v('email'), comment: v('comment') || null },
      termsAccepted: true, dropOff: { date: st.date, time: st.time || null }, turnstileToken: st.token || undefined };
    if (st.slotsOn && st.time) body.dropoffV = 1;
    btn.disabled = true; btn.textContent = T.sending;
    json(base + '/booking', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) {
      var link = r.statusUrl ? '<p><a class="btn ghost" href="' + esc(cfg.app + r.statusUrl) + '" target="_blank" rel="noopener">' + esc(T.status) + ' →</a></p>' : '';
      root.innerHTML = '<div class="bk-ok"><h2>' + esc(T.ok) + '</h2><p>' + esc(T.ok2) + '</p>' + link + '</div>';
      anim(root.firstChild); root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = T.send + ' →';
      var b = (e && e.body) || {}, m = e && e.status === 429 ? T.rate : (e && e.status === 409 ? T.full_err : (b.message || T.err));
      err.innerHTML = esc(m) + (e && e.status !== 409 && e.status !== 429 && e.status !== 422 ? ' <a href="' + esc(cfg.timma) + '" target="_blank" rel="noopener">' + esc(T.fallback) + '</a>' : '');
      if (window.turnstile && cfg.sitekey) { try { window.turnstile.reset(); st.token = ''; } catch (x) {} }
    });
  }
})();
