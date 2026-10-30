/* "Each person does their own part": the still phone.
   Base (works without GSAP, under "reduce motion"): the active step is picked from where the steps are on the screen, and the
   screens, chips, counter and step labels follow it by CSS class. Three layouts. A laptop (64rem and up): the steps left, the phone right; the active step is the last whose middle is above a line a little
   under the middle of the screen (62%). A short screen (under 32.5rem tall: a phone held sideways, 200% zoom, a large system font): the active step is the one whose text shows most in the room between the
   nav pill and the phone bar, so a text that is whole there is always the lit one; held sideways the phone sticks beside the steps, upright it sits in the flow above them. Otherwise the stacked band (the phone is
   the top of a sticky band, each step's text sticks just under it): the active step is the last whose top has come within half a text block of that spot, so the step that takes over is the one just below the phone.
   Flashy layer (.tour--rich, only when GSAP + ScrollTrigger are loaded and motion is allowed): the phone's scrubbed 3D runway between the steps, the rail filling in gold, the
   sliding chip pill, the screenshot settling as it comes in, the rolling counter. Transform and opacity only. Step tops are cached so the scroll handler reads no layout.
   The screenshots (img in each .tour-screen) are lazy, but once the page has loaded (when the browser is idle) they are fetched one at a time in step order, each asked for when the one before has come in,
   so the early steps arrive first and a slow network is not split ten ways (each is the file its own <img> would pick: 360 or 720). The step being read, and the next, jump the queue (fetchpriority high).
   A screen whose picture is late shows the app's own light ground with a faint outline of its cards, never a black hole, and nothing is drawn on it (no highlight, no tap, no sequence) until its picture is in.
   The runway (same flashy layer): the phone is flat and centred at every step's resting point; between two steps it swings and tilts in 3D (most where the screen swaps), rises from a lying-back tilt as the
   tour comes in and tilts away after the last step. It is a pure function of the scroll position (reversible), smoothed by quickTo, transform only, and its size is fitted when the page is measured to the room
   around the phone (chips above, pill, bar, the step text beside it): bold on a laptop, gentle on a phone, none in the upright short-screen layout.
   The "in use" layer (same flashy layer): each screen carries a small overlay, built here, that makes the tour look like one shift being worked through the app. On a forward step the old
   screen first gets a gold tap ring on its main button and the push starts 120 ms into it; once the next screen has settled a cool-blue highlight lands on what the step's sentence describes
   (step 1 gets two taps instead). Step 6 plays a short three-screen sequence (start, scanner with a sweep, result) once on a forward arrival. Scrolling back shows none of it, only the swipe.
   The role chips are links to each role's first step (plain anchors without this script): a click scrolls to where that step rests, smooth in ordinary motion and at once under "reduce motion".
   The hero's phone gets the same highlight once, after the page intro has finished. Positions are fractions of the screen set in CSS custom properties, so nothing is measured while scrolling.
   One gsap.context; it is reverted, and the page goes plain, when "reduce motion" turns on. */
(function () {
  "use strict";
  window.pvTour = 1; // the head script drops html.js on load if this file never ran
  var root = document.querySelector(".tour");
  if (!root) return;

  var steps = [].slice.call(root.querySelectorAll("[data-pv-step]"));
  var texts = steps.map(function (s) { return s.querySelector(".tour-text"); });
  var screens = [].slice.call(root.querySelectorAll(".tour-screen"));
  var shots = screens.map(function (s) { return [].slice.call(s.querySelectorAll("img")); }); // step 6's screen holds three
  var chips = [].slice.call(root.querySelectorAll(".tour-chip"));
  var num = root.querySelector(".tour-num");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  var wide = window.matchMedia("(min-width: 64rem)"); // the CSS breakpoint where the phone moves to the right of the steps, bigger, and leans a little
  var side = window.matchMedia("(min-width: 64rem), (max-width: 63.99rem) and (max-height: 32.5rem) and (orientation: landscape)"); // the phone beside the steps: a laptop, or a phone held sideways
  var short = window.matchMedia("(max-width: 63.99rem) and (max-height: 32.5rem)"); // a short screen: no band above the text, the phone sticks beside the steps (held sideways) or sits in the flow (upright: 200% zoom, a large font)
  var tourPhone = root.querySelector(".tour-side .tour-phone"), tourSide = root.querySelector(".tour-side");
  var active = 0, tops = [], mids = [], span = 0, stick = 0, half = 0, readLine = 0, textMids = [], textH = [], zoneFrom = 0, zoneTo = 0, dirty = true, frame = 0, fx = null;

  function pad(i) { return ("0" + (i + 1)).slice(-2); }

  // fetch a screenshot now (not when it is first shown) and decode it, so it is ready when its screen slides in. Step 6's extra two (the sequence) only when the layer will play them.
  // Each is the file its own <img> would pick (srcset and sizes). A bump for the step being read goes first (fetchpriority high).
  function warm(i, urgent) {
    var list = shots[i];
    if (!list || list.warm) return;
    list.warm = true;
    list.forEach(function (im) {
      if (im.classList.contains("seq") && !fx) return;
      if (urgent) im.fetchPriority = "high";
      im.loading = "eager";
      if (im.decode) im.decode().catch(function () {});
    });
  }
  // the pictures screen i needs, and whether they have all come in
  function picsOf(i) { return shots[i].filter(function (im) { return !(im.classList.contains("seq") && !fx); }); }
  function isIn(im) { return im.complete && im.naturalWidth > 0; }
  function loaded(i) { return picsOf(i).every(isIn); }
  function whenLoaded(i, fn) { // run fn once screen i's pictures are in (at once if they are)
    var left = picsOf(i).filter(function (im) { return !isIn(im); });
    if (!left.length) { fn(); return; }
    var n = left.length, one = function () { if (--n === 0) fn(); };
    left.forEach(function (im) { im.addEventListener("load", one, { once: true }); im.addEventListener("error", one, { once: true }); });
  }

  function measure() {
    var y = window.pageYOffset;
    var first = steps[0].getBoundingClientRect();
    span = steps[steps.length - 1].getBoundingClientRect().bottom - first.top;
    var rects = steps.map(function (s) { return s.getBoundingClientRect(); });
    tops = rects.map(function (r) { return r.top + y; });
    mids = rects.map(function (r) { return r.top + y + r.height / 2; });
    readLine = window.innerHeight * 0.62; // a laptop: a step lights when its text is above this line (a little under the middle of the screen)
    textMids = texts.map(function (t) { var r = t.getBoundingClientRect(); return r.top + y + r.height / 2; });
    textH = texts.map(function (t) { return t.offsetHeight; });
    if (short.matches) { // a short screen: the room for reading is between the nav pill and the phone bar
      var hd = document.querySelector(".site-header"), bar = document.getElementById("sticky");
      zoneFrom = hd ? hd.getBoundingClientRect().bottom : 0;
      zoneTo = window.innerHeight - (bar ? bar.offsetHeight : 0);
    }
    if (!side.matches) {
      stick = parseFloat(getComputedStyle(texts[0]).top) || 0; // where a step's text sticks, just under the band
      half = Math.max.apply(null, texts.map(function (t) { return t.offsetHeight; })) / 2;
    }
    if (fx) fx.layout();
    update();
  }

  function update() {
    var y = window.pageYOffset, a = 0;
    if (fx) fx.move(y);
    if (span > window.innerHeight) {
      if (short.matches) { // a short screen: the step whose text shows most in the room between the pill and the bar, so a text that is whole there is always the lit one
        var best = -1e9;
        for (var k = 0; k < textMids.length; k++) { var top = textMids[k] - textH[k] / 2 - y, v = Math.min(top + textH[k], zoneTo) - Math.max(top, zoneFrom); if (v > best + 0.5) { best = v; a = k; } }
      } else if (side.matches) { for (var i = 0; i < mids.length; i++) if (mids[i] < y + readLine) a = i; } // a laptop: the step whose text is nearest the middle of the screen
      else { for (var j = 0; j < tops.length; j++) if (tops[j] < y + stick + half) a = j; } // the step whose text has come within half a block of the band
    }
    if (a !== active) show(a);
  }

  /* ---- the 3D runway ---- */
  var PERSP = 1600, RAD = Math.PI / 180, run = null;
  // where a point of the phone (px, py from its centre) lands on the screen under the move T = {x, y, rx, ry, s}, seen through the column's perspective (g: the phone's centre and the perspective origin)
  function project(px, py, T, g) {
    var cx = Math.cos(T.rx * RAD), sx = Math.sin(T.rx * RAD), cy = Math.cos(T.ry * RAD), sy = Math.sin(T.ry * RAD);
    var y1 = py * T.s * cx, z1 = py * T.s * sx;
    var x2 = px * T.s * cy + z1 * sy, z2 = -px * T.s * sy + z1 * cy;
    var k = PERSP / (PERSP - z2);
    return [g.cx + g.ox + (x2 + T.x - g.ox) * k, g.cy + g.oy + (y1 + T.y - g.oy) * k];
  }
  function extent(T, g) {
    var e = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
    g.pts.forEach(function (q) { var v = project(q[0], q[1], T, g); e.l = Math.min(e.l, v[0]); e.r = Math.max(e.r, v[0]); e.t = Math.min(e.t, v[1]); e.b = Math.max(e.b, v[1]); });
    return e;
  }
  var SIGNS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  // the biggest move, up to `want`, that keeps the phone (and its tab) inside lim for every way the move can lean: it gives up scale and the X lean first for height, the sideways swing, the Y turn and scale for width
  function fitPeak(want, g, lim) {
    var Q = { x: want.x, y: 0, rx: want.rx, ry: want.ry, s: want.s };
    var rest = extent({ x: 0, y: 0, rx: 0, ry: 0, s: 1 }, g);
    var L = Math.min(lim.l, rest.l), R = Math.max(lim.r, rest.r), Tp = Math.min(lim.t, rest.t), B = Math.max(lim.b, rest.b); // the rest itself always counts as room
    function all(q) { return SIGNS.map(function (sg) { return extent({ x: q.x, y: 0, rx: sg[0] * q.rx, ry: sg[1] * q.ry, s: q.s }, g); }); }
    function vOk(q) { // some one drift in y keeps every lean inside the room above and below
      var lo = -1e9, hi = 1e9;
      all(q).forEach(function (e) { lo = Math.max(lo, Tp - e.t); hi = Math.min(hi, B - e.b); });
      q.y = lo <= hi ? Math.min(Math.max(0, lo), hi) : (lo + hi) / 2; // (at the very edge of what fits, the middle of the two)
      return lo <= hi + 0.5;
    }
    function hOk(q) { return all(q).every(function (e) { return e.l >= L - 0.5 && e.r <= R + 0.5; }); }
    function cut(q, k) { var n = k === "s" ? 1 : 0, st = Math.abs(want[k] - n) / 24; q[k] = want[k] > n ? Math.max(n, q[k] - st) : Math.min(n, q[k] + st); }
    ["s", "rx"].forEach(function (k) { for (var i = 0; i < 24 && !vOk(Q); i++) cut(Q, k); });
    ["x", "ry", "s"].forEach(function (k) { for (var i = 0; i < 24 && !hOk(Q); i++) cut(Q, k); });
    vOk(Q);
    return Q;
  }
  // measure the room and fit the move to it (called with the page's other measurements; the only place the runway reads layout)
  function layoutRunway() {
    run = null;
    var kind = wide.matches ? "laptop" : short.matches ? (side.matches ? "gentle" : "") : "band";
    if (!kind || !tourPhone || !root.classList.contains("tour--rich") || !tops.length) return;
    var vw = window.innerWidth, vh = window.innerHeight, sr = tourSide.getBoundingClientRect(), stuck = parseFloat(getComputedStyle(tourSide).top) || 0;
    var W = tourPhone.offsetWidth, H = tourPhone.offsetHeight, tab = tourPhone.querySelector(".tour-tab"), box = root.querySelector(".tour-chips");
    var cx = sr.left + tourPhone.offsetLeft + W / 2, cy = stuck + tourPhone.offsetTop + H / 2;
    var g = { cx: cx, cy: cy, ox: sr.left + tourSide.offsetWidth / 2 - cx, oy: stuck + tourSide.offsetHeight / 2 - cy, pts: [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]] };
    if (tab) { var tl = tab.offsetLeft + tourPhone.clientLeft - W / 2, tt = tab.offsetTop + tourPhone.clientTop - H / 2; g.pts.push([tl, tt], [tl + tab.offsetWidth, tt]); }
    var pill = document.querySelector(".site-header .pill"), bar = document.getElementById("sticky"), cnt = root.querySelector(".tour-count");
    var chipsBottom = box && box.getClientRects().length ? stuck + box.offsetTop + box.offsetHeight : 0;
    var barTop = bar && bar.offsetHeight && getComputedStyle(bar).display !== "none" ? vh - bar.offsetHeight : vh;
    var lim = { l: 8, r: vw - 8, t: Math.max(pill ? pill.getBoundingClientRect().bottom : 0, chipsBottom, kind === "band" ? stuck : 0), b: kind === "band" ? stuck + (cnt ? cnt.offsetTop : tourSide.offsetHeight) - 1 : Math.min(vh, barTop) - 8 }; // in the band the phone stops short of the counter under it
    var want, enter, leave;
    if (kind === "laptop") { // bold: swings out over the gap between the columns (never over the text), up to about 22 deg and 15% bigger
      var right = 0;
      texts.forEach(function (t) { [".tour-label", "h3", ".tour-copy"].forEach(function (q) { var rg = document.createRange(); rg.selectNodeContents(t.querySelector(q)); [].forEach.call(rg.getClientRects(), function (r) { if (r.width > 0.5) right = Math.max(right, r.right); }); }); });
      lim.l = right + 12; lim.r = vw - 12;
      want = { x: -Math.min(220, 0.15 * vw), rx: 10, ry: 22, s: 1.15 };
      enter = { x: 0, y: 0.35 * vh, rx: 40, ry: 10, s: 0.9 }; leave = { x: 0, y: 0, rx: 35, ry: -8, s: 0.92 }; // the exit tilts away in place: a drift down carried it onto the panels below the steps
    } else { // gentle: a few degrees and a little lift, no drift, inside what room the band (or the room beside the steps) leaves
      want = { x: 0, rx: 2.5, ry: 5, s: 1.03 };
      enter = { x: 0, y: 0, rx: 35, ry: 0, s: 0.94 }; leave = { x: 0, y: 0, rx: 30, ry: 0, s: 0.96 };
    }
    var rest = [], swp = [], n = steps.length;
    for (var i = 0; i < n; i++) rest.push(restY(i));
    for (var j = 0; j < n - 1; j++) { // where the screen swaps (as update() decides it): the top of the move
      var d = rest[j + 1] - rest[j], at = short.matches ? rest[j] + d / 2 : side.matches ? mids[j + 1] - readLine : tops[j + 1] - stick - half;
      swp.push(Math.min(Math.max(at, rest[j] + 0.3 * d), rest[j + 1] - 0.1 * d));
    }
    run = { rest: rest, swap: swp, peak: fitPeak(want, g, lim), enter: enter, leave: leave, from: rest[0] - 0.6 * vh, len: 0.5 * vh };
  }
  // the move at scroll position y: [x, y, rotationX, rotationY, scale]. Flat at every rest (and at the ends of the ease, so near a rest it is flat too), the full move where the screen swaps
  function runwayAt(y, o) {
    var r = run.rest, n = r.length, w, E;
    if (y <= r[0]) { w = y <= run.from ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (y - run.from) / (r[0] - run.from)); E = run.enter; }
    else if (y >= r[n - 1]) { var v = (y - r[n - 1]) / run.len; w = v >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * v); E = run.leave; }
    else {
      var i = 0; while (i < n - 2 && y >= r[i + 1]) i++;
      var sw = run.swap[i], b = y < sw ? Math.sin(Math.PI / 2 * (y - r[i]) / (sw - r[i])) : Math.cos(Math.PI / 2 * (y - sw) / (r[i + 1] - sw)), P = run.peak, sg = i % 2 ? -1 : 1;
      b *= b;
      o[0] = P.x * b; o[1] = P.y * b; o[2] = -sg * P.rx * b; o[3] = sg * P.ry * b; o[4] = 1 + (P.s - 1) * b;
      return;
    }
    o[0] = E.x * w; o[1] = E.y * w; o[2] = E.rx * w; o[3] = E.ry * w; o[4] = 1 + (E.s - 1) * w;
  }

  // the screens follow the active step by class; the CSS pushes them (the one after the active one waits on the right, the one before it sits off to the left)
  function swap(to) {
    var t = to === undefined ? active : to;
    screens.forEach(function (s, i) { s.classList.toggle("is-active", i === t); s.classList.toggle("is-before", i < t); });
  }

  function show(a) {
    var prev = active, chip = +steps[a].getAttribute("data-chip");
    active = a;
    warm(a, true); warm(a + 1, true); warm(a - 1); warm(a + 2);
    steps.forEach(function (s, i) { s.classList.toggle("is-active", i === a); });
    chips.forEach(function (c, i) { c.classList.toggle("is-on", i === chip); if (i === chip) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current"); });
    if (fx) fx.change(a, prev, a > prev ? 1 : -1, chip); else { swap(); num.textContent = pad(a); }
  }

  function schedule(remeasure) {
    if (remeasure) dirty = true;
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      if (dirty) { dirty = false; measure(); } else update();
    });
  }

  /* ---- the "in use" layer: builders shared by the tour and the hero's phone ---- */
  function useLayer(screen) {
    var layer = document.createElement("div");
    layer.className = "tour-use";
    layer.setAttribute("aria-hidden", "true");
    screen.appendChild(layer);
    return layer;
  }
  function useEl(layer, cls, vars) {
    var e = document.createElement("i");
    e.className = cls;
    for (var k in vars) e.style.setProperty("--" + k, vars[k]);
    layer.appendChild(e);
    return e;
  }
  // the arrival highlight, about 0.8 s: it fades in with one pulse (scale .98 to 1), then settles to 35% and holds
  function lightUp(tl, el, at) {
    tl.fromTo(el, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out", immediateRender: false }, at);
    tl.to(el, { opacity: 0.35, duration: 0.4, ease: "sine.inOut" }, at + 0.4);
  }
  // a tap: a gold ring grows from .6 to 1.1 as it fades, 260 ms
  function tapAt(tl, el, at) {
    tl.fromTo(el, { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 1.1, duration: 0.26, ease: "power2.out", immediateRender: false }, at);
  }
  // the hero's phone (phone widths): the same highlight once, after the page intro has finished
  var heroUse = null;
  function startHero() {
    var screen = document.querySelector(".hero-phone .tour-screen");
    if (!screen || !window.gsap || still.matches || wide.matches) return;
    var layer = useLayer(screen), hit = useEl(layer, "use-hit", { x: 0.5, y: 0.22, w: 0.9, h: 0.1 });
    heroUse = { layer: layer, tl: null };
    var pic = screen.querySelector("img");
    var go = function () {
      if (!heroUse || heroUse.tl) return;
      if (pic && !isIn(pic)) { pic.addEventListener("load", go, { once: true }); return; } // never a highlight on an empty screen
      heroUse.tl = window.gsap.timeline({ delay: 0.15 });
      lightUp(heroUse.tl, hit, 0);
    };
    if (document.getElementById("intro")) { window.addEventListener("pvintro", go, { once: true }); setTimeout(go, 2800); } else go();
  }
  function stopHero() {
    if (!heroUse) return;
    if (heroUse.tl) heroUse.tl.kill();
    if (heroUse.layer.parentNode) heroUse.layer.parentNode.removeChild(heroUse.layer);
    heroUse = null;
  }

  /* ---- flashy layer ---- */
  function startFx() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST) return null;
    if (!gsap.core.globals().ScrollTrigger) gsap.registerPlugin(ST);

    var phone = root.querySelector(".tour-side .tour-phone");
    var box = root.querySelector(".tour-chips");
    var count = root.querySelector(".tour-count");
    var grid = root.querySelector(".tour-grid");
    var list = root.querySelector(".tour-steps");
    var chipNow = +steps[active].getAttribute("data-chip");

    var pill = document.createElement("span");
    pill.className = "tour-pill";
    box.insertBefore(pill, box.firstChild);
    var rail = document.createElement("div");
    var fill = document.createElement("i");
    rail.className = "tour-rail";
    rail.setAttribute("aria-hidden", "true");
    rail.style.setProperty("--n", steps.length); // the rail's segments: one per step (css/tour.css)
    rail.appendChild(fill);
    count.appendChild(rail);
    num.innerHTML = "<span>" + pad(active) + "</span>";

    function place(animate) {
      var el = chips[chipNow], f = chips[0];
      if (!el.offsetWidth) return; // the chips are hidden on short phones
      pill.style.width = f.offsetWidth + "px";
      pill.style.height = f.offsetHeight + "px";
      var to = { x: el.offsetLeft, y: el.offsetTop, scaleX: el.offsetWidth / f.offsetWidth, scaleY: el.offsetHeight / f.offsetHeight };
      if (animate) gsap.to(pill, Object.assign({ duration: 0.5, ease: "power3.out", overwrite: "auto" }, to));
      else gsap.set(pill, to);
    }

    // the incoming screenshot settles from a touch larger behind the screen's own sideways slide (the slide is CSS, so it can be interrupted)
    function settle(im) {
      gsap.fromTo(im, { scale: 1.035, transformOrigin: "50% 0%" }, { scale: 1, duration: 0.7, ease: "power3.out", overwrite: "auto", clearProps: "transform,transformOrigin" });
    }

    // the counter rolls: the old number leaves upward, the new one comes up from below (or the reverse when scrolling back)
    function roll(a, dir) {
      var old = num.lastElementChild, next = document.createElement("span");
      while (num.children.length > 1) num.removeChild(num.firstChild);
      next.textContent = pad(a);
      num.appendChild(next);
      gsap.fromTo(next, { yPercent: 110 * dir }, { yPercent: 0, duration: 0.4, ease: "power3.out", overwrite: "auto" });
      gsap.to(old, { yPercent: -110 * dir, duration: 0.4, ease: "power3.out", overwrite: "auto", onComplete: function () { if (old.parentNode) old.parentNode.removeChild(old); } });
    }

    var ctx, grow, move = function () {}, tgt = [0, 0, 0, 0, 1], last = [0, 0, 0, 0, 1], SMOOTH = { duration: 0.5, ease: "power3.out" }; // the move is smoothed over half a second
    function inCtx(fn) { if (ctx) ctx.add(fn); else fn(); } // ScrollTrigger can fire onEnter while the context is still being built
    ctx = gsap.context(function () {
      var qx = gsap.quickTo(phone, "x", SMOOTH), qy = gsap.quickTo(phone, "y", SMOOTH), qrx = gsap.quickTo(phone, "rotationX", SMOOTH), qry = gsap.quickTo(phone, "rotationY", SMOOTH), qsx = gsap.quickTo(phone, "scaleX", SMOOTH), qsy = gsap.quickTo(phone, "scaleY", SMOOTH); // (quickTo has no "scale")
      move = function (y) {
        if (run) runwayAt(y, tgt); else { tgt[0] = tgt[1] = tgt[2] = tgt[3] = 0; tgt[4] = 1; }
        for (var i = 0; i < 5; i++) if (Math.abs(tgt[i] - last[i]) > 0.001) { qx(tgt[0]); qy(tgt[1]); qrx(tgt[2]); qry(tgt[3]); qsx(tgt[4]); qsy(tgt[4]); last = tgt.slice(); return; }
      };
      grow = gsap.quickTo(fill, "scaleX", { duration: 0.4, ease: "power3.out" });
      grow((active + 1) / steps.length); // the rail's segments always equal the counter
      // the phone is promoted to its own layer only while the tour is on screen
      ST.create({ trigger: grid, start: "top bottom", end: "bottom top", onToggle: function (self) { phone.classList.toggle("is-live", self.isActive); } });
    }, root);

    place(false);
    root.classList.add("tour--rich");

    // ---- the "in use" layer: what each screen shows being used (fractions of the screen: x, y centre; w, h size) ----
    var USE = {
      "01-start-shift": { arrive: [[0.265, 0.21], [0.73, 0.574]], leave: [0.5, 0.928] },
      "02-closing-readings": { hit: [0.5, 0.46, 0.82, 0.05], leave: [0.5, 0.935] },
      "03-reconcile-shift": { hit: [0.66, 0.793, 0.45, 0.035], leave: [0.5, 0.935] },
      "04-approve-and-lock": { hit: [0.5, 0.414, 0.9, 0.085], leave: [0.5, 0.414] },
      "05-dip-and-density": { hit: [0.5, 0.6, 0.82, 0.08], leave: [0.5, 0.935] },
      "06-tanker-receipt": { hit: [0.5, 0.66, 0.82, 0.1], leave: [0.5, 0.935] },
      "07-owner-home": { hit: [0.5, 0.22, 0.9, 0.1] }
    };
    var SEQ = { shot: "06a-scan-invoice-qr", tap: [0.5, 0.257], view: [0.17, 0.26, 0.83, 0.57], hit: [0.5, 0.348, 0.9, 0.29] }; // step 6: tap Scan invoice QR, then the scanner's viewfinder; at the end the filled-in fields
    var EO = "expo.out"; // the CSS swipe's curve
    var uses = [], useEls = [], seq = null, seqScreen = null, swapCall = null, swapTo = 0, leaveTl = null, arriveTl = null;

    screens.forEach(function (sc, i) {
      var shot = sc.getAttribute("data-shot"), cfg = USE[shot], u = null;
      if (cfg) {
        var layer = useLayer(sc);
        u = { hit: null, arrive: [], leave: null, layer: layer };
        if (cfg.hit) u.hit = useEl(layer, "use-hit", { x: cfg.hit[0], y: cfg.hit[1], w: cfg.hit[2], h: cfg.hit[3] });
        (cfg.arrive || []).forEach(function (p) { u.arrive.push(useEl(layer, "use-tap", { x: p[0], y: p[1] })); });
        if (cfg.leave) u.leave = useEl(layer, "use-tap", { x: cfg.leave[0], y: cfg.leave[1] });
        useEls.push.apply(useEls, [u.hit, u.leave].concat(u.arrive).filter(Boolean));
      } else if (shot === SEQ.shot && shots[i].length === 3) {
        var lay = useLayer(sc), vf = useEl(lay, "use-vf", { x0: SEQ.view[0], y0: SEQ.view[1], x1: SEQ.view[2], y1: SEQ.view[3] }), line = document.createElement("i");
        line.className = "use-line";
        vf.appendChild(line);
        seqScreen = sc;
        seq = { start: shots[i][0], cam: shots[i][1], res: shots[i][2], tap: useEl(lay, "use-tap", { x: SEQ.tap[0], y: SEQ.tap[1] }), line: line, tl: null, rest: null };
        seq.hit = useEl(lay, "use-hit", { x: SEQ.hit[0], y: SEQ.hit[1], w: SEQ.hit[2], h: SEQ.hit[3] });
        u = { layer: lay, arrive: [] };
        useEls.push(seq.tap, line, seq.hit);
      }
      uses.push(u);
    });

    function useReset() {
      if (swapCall) { swapCall.kill(); swapCall = null; }
      if (leaveTl) { leaveTl.kill(); leaveTl = null; }
      if (arriveTl) { arriveTl.kill(); arriveTl = null; }
      if (useEls.length) gsap.set(useEls, { opacity: 0 });
    }

    // step 6's sequence: the start screen, a tap on "Scan invoice QR", a push to the scanner and a sweep down its viewfinder, a push to the result and a highlight on the filled-in fields (about 3 s, once).
    // A push is the same as the screens' own (css/tour.css): the new picture comes in from the right over the old one, which drifts 30% left beneath it. Both stay opaque, so the phone never dims.
    function swipe(t, out, inn, at) {
      t.to(out, { xPercent: -30, duration: 0.42, ease: EO }, at);
      t.fromTo(inn, { xPercent: 100 }, { xPercent: 0, duration: 0.42, ease: EO, immediateRender: false }, at);
    }
    function seqClear() { // back to rest: the result alone, no inline styles on the pictures
      if (!seq) return;
      if (seq.rest) { seq.rest.kill(); seq.rest = null; }
      if (seq.tl) { seq.tl.kill(); seq.tl = null; }
      gsap.set([seq.start, seq.cam, seq.res], { clearProps: "opacity,transform,display" });
      [seq.start, seq.cam, seq.res].forEach(function (im) { if (!im.getAttribute("style")) im.removeAttribute("style"); }); // no empty style attribute left behind
      gsap.set(seq.line, { opacity: 0, yPercent: -100 });
    }
    function seqLeave() { // left mid-sequence: stop it now, and put the result back once the screen has gone
      if (!seq) return;
      if (seq.tl) { seq.tl.kill(); seq.tl = null; }
      if (!seq.rest) seq.rest = gsap.delayedCall(0.22, seqClear);
    }
    function seqPlay() {
      seqClear();
      gsap.set(seq.start, { display: "block" });
      gsap.set(seq.cam, { display: "block", xPercent: 100 });
      gsap.set(seq.res, { xPercent: 100 });
      var t = seq.tl = gsap.timeline({ onComplete: seqClear });
      tapAt(t, seq.tap, 0.7);
      swipe(t, seq.start, seq.cam, 0.82);
      t.fromTo(seq.line, { opacity: 1, yPercent: -100 }, { yPercent: 0, duration: 0.8, ease: "power1.inOut", immediateRender: false }, 1.0);
      t.to(seq.line, { opacity: 0, duration: 0.15, ease: "none" }, 1.7);
      swipe(t, seq.cam, seq.res, 1.85);
      lightUp(t, seq.hit, 2.3); // the payoff: the fields the app has filled in
    }

    // the next screen is pushed in (CSS) and settles; a forward arrival at step 6 plays its sequence, a backward one shows the result as it is
    function land(dir, to) {
      var t = to === undefined ? active : to;
      swap(t);
      var im = shots[t][shots[t].length - 1];
      if (seq && screens[t] === seqScreen) {
        if (dir > 0) {
          if (loaded(t)) { seqPlay(); im = seq.start; }
          else { seqClear(); whenLoaded(t, function () { if (active === t) seqPlay(); }); } // the pictures are late: the sequence starts when they are in
        } else seqClear();
      }
      settle(im);
    }

    function arrive(a, wait) { // forward only: the highlight (or step 1's two taps), once the screen has settled
      var u = uses[a];
      if (!u || !(u.hit || u.arrive.length)) return;
      if (!loaded(a)) { whenLoaded(a, function () { if (active === a && !arriveTl) arrive(a, 0.15); }); return; } // never a highlight on an empty screen: it comes once the picture is in
      arriveTl = gsap.timeline({ delay: wait });
      u.arrive.forEach(function (r, k) { tapAt(arriveTl, r, k * 0.25); });
      if (u.hit) lightUp(arriveTl, u.hit, 0);
    }

    // step 1 gets its two taps when the tour first comes into view
    var firstIn = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      firstIn.disconnect();
      if (active === 0) inCtx(function () { useReset(); arrive(0, 0.6); });
    }, { threshold: 0.6 });
    firstIn.observe(phone);

    return {
      layout: function () { place(false); layoutRunway(); },
      move: function (y) { move(y); },
      change: function (a, prev, dir, chip) {
        inCtx(function () {
          if (swapCall) { swapCall.kill(); swapCall = null; land(1, swapTo); } // a flick: the screen that was about to come in comes in now, so the phone keeps up with the counter
          useReset();
          if (seq && screens[prev] === seqScreen) seqLeave();
          var from = uses[prev], wait = 0.6;
          if (dir > 0 && from && from.leave && loaded(prev)) { // a gold tap on the old screen's button, and the push starts 120 ms into it
            leaveTl = gsap.timeline();
            tapAt(leaveTl, from.leave, 0);
            swapTo = a;
            swapCall = gsap.delayedCall(0.12, function () { swapCall = null; land(dir, a); });
            wait = 0.72;
          } else land(dir, a);
          if (dir > 0) arrive(a, wait);
          roll(a, dir);
          grow((a + 1) / steps.length);
          if (chip !== chipNow) { chipNow = chip; place(true); }
        });
      },
      stop: function () {
        firstIn.disconnect();
        ctx.revert();
        if (seq) seqClear();
        uses.forEach(function (u) { if (u && u.layer.parentNode) u.layer.parentNode.removeChild(u.layer); });
        swap();
        [].slice.call(root.querySelectorAll("[style]")).forEach(function (e) { e.removeAttribute("style"); }); // the markup has no inline styles; these are all GSAP's
        root.classList.remove("tour--rich");
        phone.classList.remove("is-live");
        run = null;
        pill.parentNode.removeChild(pill);
        rail.parentNode.removeChild(rail);
        num.textContent = pad(active);
      }
    };
  }

  // "reduce motion" turning on: the flashy layer goes and the page is plain (the screens still swap by class). Turning it off again shows the plain page until the next visit.
  function onMotion() {
    if (still.matches) stopHero();
    if (still.matches && fx) { fx.stop(); fx = null; document.documentElement.classList.remove("js"); }
  }

  // the pictures, one at a time in step order, each asked for when the one before has come in, so the first steps arrive soonest and a late network never splits its bandwidth ten ways.
  // It starts once the page has loaded (then when the browser is idle), or as soon as the tour is within a screen; the step being read always goes first (show() bumps it).
  var chained = false;
  function chain(i) {
    if (i >= shots.length) return;
    warm(i);
    var moved = false, next = function () { if (moved) return; moved = true; clearTimeout(t); chain(i + 1); }, t = setTimeout(next, 3500); // never stuck behind one picture
    whenLoaded(i, next);
  }
  function startChain() { if (chained) return; chained = true; chain(0); }
  var later = function (fn) { if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 2500 }); else setTimeout(fn, 600); };
  if (document.readyState === "complete") later(startChain); else window.addEventListener("load", function () { later(startChain); });
  if ("IntersectionObserver" in window) {
    var near = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { near.disconnect(); startChain(); } }, { rootMargin: "100% 0px" });
    near.observe(root);
  }

  if (!still.matches) { fx = startFx(); startHero(); }
  if (still.addEventListener) still.addEventListener("change", onMotion);
  if (wide.addEventListener) wide.addEventListener("change", function () { schedule(true); });
  if (side.addEventListener) side.addEventListener("change", function () { schedule(true); });
  if (short.addEventListener) short.addEventListener("change", function () { schedule(true); });
  window.addEventListener("scroll", function () { schedule(false); }, { passive: true });
  window.addEventListener("load", function () { schedule(true); });
  if (window.ResizeObserver) new ResizeObserver(function () { schedule(true); }).observe(document.body);
  else window.addEventListener("resize", function () { schedule(true); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      schedule(true);
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }
  // the role chips are links to each role's first step. A click scrolls to where that step rests (its text in the middle of the room it is read in), so the step is lit and its screen is shown;
  // smooth in ordinary motion, at once under "reduce motion". Without this script they are plain anchors to the step.
  function restY(i) {
    if (short.matches) return textMids[i] - (zoneFrom + zoneTo) / 2;
    if (side.matches) return mids[i] - window.innerHeight * 0.5;
    return tops[i] - stick;
  }
  chips.forEach(function (c, ci) {
    c.addEventListener("click", function (e) {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      for (var k = 0; k < steps.length; k++) if (+steps[k].getAttribute("data-chip") === ci) break;
      if (k === steps.length) return;
      e.preventDefault();
      measure();
      window.scrollTo({ top: Math.max(0, Math.round(restY(k))), behavior: still.matches ? "auto" : "smooth" });
    });
  });
  schedule(true);
})();
