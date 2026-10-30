/* The hero's picture: the owner's screen on laptops (>= 64rem), a phone on phones.
   1. Fit (always, no GSAP needed): the picture is a slot of the hero. The scale, the picture's own width and the window's height are chosen together so that the window ends in
      the gap just under the four "Yesterday" figures: the first screen shows the alerts and the figures, and the window's edge falls between two blocks, never through text.
      The scale is held to 0.72 and up so the figures stay readable; on a very short screen the picture is started a little way down instead (see y0).
   2. Page open: the panel settles out of a tilt, flat when it has finished, and the first part of the picture plays in. The rest plays as it comes into the window.
      The load intro's cover (js/site.js) hides the page for its first 1.25 s, so this waits for the cover to start fading (the "pvfly" event) and the page is seen settling as it appears;
      without the cover it starts at once. The hero's phone is painted from the start and its entrance waits for the same moment.
   3. Runway (motion only, from 64rem): the hero is pinned under the nav while the page's scroll, scrubbed and linear, moves the app's main column up through the window.
      The sidebar stays where it is, as it does in the app. The headline dims a little over the first part of the run.
      On phones the phone settles in once, then turns slightly as the hero scrolls away.
   Without motion (no script, or "reduce motion") the window is a focusable region the reader scrolls, and nothing is hidden.
   GSAP and ScrollTrigger are already on the page (vendor/gsap). Transform and opacity only. One gsap.context; reverted, with the page plain, when "reduce motion" turns on. */
(function () {
  "use strict";
  window.pvBoard = 1; // the head script drops html.js on load if this file never ran
  var fig = document.querySelector(".ovb");
  if (!fig) return;
  var win = fig.querySelector(".ovb-win");
  var scaleEl = fig.querySelector(".ovb-scale");
  var frame = fig.querySelector(".ovb-frame");
  var main = fig.querySelector(".ovb-main");
  var stats = fig.querySelector(".ovb-stats");
  var firstSec = fig.querySelector(".ovb-main > .ovb-sec"); // "Needs your attention": the first block under the head
  var hero = document.querySelector(".hero");
  var visual = document.querySelector(".hero-visual");
  var headText = document.querySelector(".hero h1");
  var phone = document.querySelector(".hero-phone");
  var W_MIN = 1180; // the picture is never laid out narrower than the board it was drawn on
  var S_MIN = 0.72; // nor shown smaller than this
  var HUG_GAP = 24; // a window this much shorter than its slot ends the hero (px)
  var HEAD_PAD = 10; // the picture's own padding above its first line (picture px): an offset this small hides no text
  var DESKTOP = "(min-width: 64rem)";
  var fitPw = 0, fitRoom = 0; // what the last fit was made for
  var scale = 0, wide = W_MIN, y0 = 0, dist = 0; // scale; the picture's width and its start offset (both in the picture's own pixels); how far it runs
  var started = false;
  var left = 0; // parts of the picture still to play
  var lazy = []; // parts that play as they come into the window: { tl, top (in picture px), done }
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var canAnimate = !(still && still.matches) && !!window.gsap;
  var ctx = null, mm = null;

  function show() { fig.classList.add("is-on"); }
  function q(sel, from) { return (from || fig).querySelectorAll(sel); }
  function topIn(el) { var t = 0; while (el && el !== scaleEl) { t += el.offsetTop; el = el.offsetParent; } return t; }

  // where the window should end: the middle of the gap under the four figures, in the picture's own pixels
  function stop() { return topIn(stats) + stats.offsetHeight + 8; }
  function winH() { return win.clientHeight + 2; } // the window's outer height, the 1px edges included

  // what the hero leaves for the picture when it is one screen tall (the CSS: min-height 100svh - chrome, less the padding and the head), or the picture's own minimum.
  // Worked out from the page, not read from the slot: the slot is the window's size once the hero hugs it, and the pin freezes the hero at its last size.
  function slotRoom() {
    var cs = getComputedStyle(hero), opener = hero.querySelector(".opener");
    var chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chrome-h")) || 0;
    var around = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + opener.offsetHeight + parseFloat(getComputedStyle(opener).marginBottom);
    return Math.max(parseFloat(getComputedStyle(visual).minHeight) || 0, window.innerHeight - chrome - around);
  }

  function fit() {
    var pw = fig.clientWidth - 2; // inside the window's 1px edges
    if (pw <= 0) return; // hidden (below the desktop breakpoint)
    var room = slotRoom();
    // the picture's own height (c) changes with the width it is laid out at (its text wraps differently), so a fit that follows c alone can swing between two scales for ever, once a longer lead has made
    // the head taller; the same slot gives the same fit, so it is made again only when the slot changes (or a new face has come in, which sets scale to 0)
    if (scale && pw === fitPw && Math.abs(room - fitRoom) < 1) return;
    fitPw = pw; fitRoom = room;
    var c = stop();
    var s = Math.round(Math.min(pw / W_MIN, Math.max(S_MIN, room / c)) * 1000) / 1000;
    var w = Math.round(pw / s);
    var h = Math.round(Math.min(room, c * s));
    var off = canAnimate ? Math.max(0, Math.round((c * s - h) / s)) : 0;
    // a picture started part-way down must start between two blocks, never through the date line or the title: past the few pixels of padding at its top it starts at the section below its head,
    // and the window is that much shorter, so its lower edge still falls in the gap under the figures (a short laptop, where the picture has hit its smallest size)
    if (off > HEAD_PAD && firstSec) {
      var start = Math.round(topIn(firstSec) - 12);
      if (off < start) { off = start; h = Math.round((c - off) * s); }
    }
    var hug = h < room - HUG_GAP; // the width, not the height, sets the size: the hero ends with the window
    var flipped = hug !== hero.classList.contains("is-hug");
    hero.classList.toggle("is-hug", hug);
    if (!flipped && Math.abs(s - scale) < 0.006 && Math.abs(w - wide) < 8 && Math.abs(h - winH()) < 3 && off === y0) return;
    scale = s; wide = w; y0 = off;
    fig.style.setProperty("--ovb-s", s);
    fig.style.setProperty("--ovb-w", w + "px");
    fig.style.setProperty("--ovb-wh", h + "px");
    dist = Math.max(0, frame.offsetHeight - (h - 2) / s - y0);
    if (started && window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 60);
  }

  // one part of the picture: its tweens; when it has played its pieces drop their inline styles and take .is-in
  function part(containers, extra, tweens) {
    var els = extra ? [extra] : [];
    containers.forEach(function (c) { [].push.apply(els, c.querySelectorAll("[data-ov]")); });
    left += 1;
    var tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power3.out" },
      onComplete: function () {
        gsap.set(els, { clearProps: "opacity,transform" });
        els.forEach(function (e) { e.classList.add("is-in"); });
        left -= 1;
        if (left === 0) show();
      }
    });
    tweens(tl);
    return tl;
  }

  function playLazy() { lazy.forEach(function (p) { if (!p.done) { p.done = true; p.tl.play(); } }); }

  // the picture's main column is `offset` px (in picture px) up: play the parts that have come into the window
  function reveal(offset) {
    var room = (winH() - 2) / scale;
    lazy.forEach(function (p) { if (!p.done && p.top < offset + room * 0.9) { p.done = true; p.tl.play(); } });
  }

  function build() {
    var side = q(".ovb-side")[0];
    var top = q(".ovb-main > .ovb-head")[0];
    var secs = q(".ovb-main > .ovb-sec"); // needs attention, yesterday, today so far
    var a = secs[0], y = secs[1], t = secs[2];

    // the panel settles out of a tilt (one motion: tilt, rise and fade together) and ends flat; then the first screen fills in
    var open = part([side, top, a], fig, function (tl) {
      tl.fromTo(fig, { opacity: 0, y: 48, rotationX: -12, transformPerspective: 1400, transformOrigin: "50% 0%" }, { opacity: 1, y: 0, rotationX: 0, duration: 1, ease: "expo.out" }, 0);
      tl.fromTo(q(".ovb-nav-i", side), { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.06 }, 0.3);
      tl.fromTo(q(".ovb-hl, .ovb-rates", top), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.4);
      tl.fromTo(q(".ovb-item", a), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07 }, 0.45);
      tl.fromTo(q(".ovb-badge, .ovb-tile", a), { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.45, stagger: 0.06 }, 0.6);
    });

    // yesterday: its heading row, the four figures, then the two charts, whose bars grow
    var yest = part([y], null, function (tl) {
      tl.fromTo(q(".ovb-yh", y), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 }, 0);
      tl.fromTo(q(".ovb-stats .ovb-card", y), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 }, 0.05);
      tl.fromTo(q(".ovb-two > .ovb-card2", y), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08 }, 0.1);
      tl.fromTo(q(".ovb-two .ovb-fill", y), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.55, stagger: 0.05 }, 0.2);
      tl.fromTo(q(".ovb-stack", y), { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.55, stagger: 0.04 }, 0.25);
    });

    // today so far
    var today = part([t], null, function (tl) {
      tl.fromTo(q(".ovb-yl[data-ov]", t), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 }, 0);
      tl.fromTo(q(".ovb-three > .ovb-card2", t), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.07 }, 0.05);
      tl.fromTo(q(".ovb-three .ovb-fill", t), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.55, stagger: 0.05 }, 0.1);
    });

    lazy = [{ tl: yest, top: topIn(y), done: false }, { tl: today, top: topIn(t), done: false }];
    // the figures are on the first screen: they play with the opening, which waits for the load intro's flight (js/site.js) so the page is seen settling as it appears
    ScrollTrigger.create({ trigger: fig, start: "top 92%", once: true, onEnter: function () { afterIntro(function () { open.play(); reveal(y0); }); } });
  }

  // the load intro's cover (js/site.js) hides the page for its first 1.25 s: run `fn` when the cover starts to fade out (the "pvfly" event), at once if there is no cover, or after 2.6 s whatever happens
  function afterIntro(fn) {
    var cover = document.getElementById("intro"), done = false;
    var go = function () { if (done) return; done = true; window.removeEventListener("pvfly", go); fn(); };
    if (!cover || window.pvFlyDone || getComputedStyle(cover).display === "none") { go(); return; }
    window.addEventListener("pvfly", go);
    setTimeout(go, 2600);
  }

  // only once the picture is on screen at all (the panel is display:none below the desktop breakpoint)
  function start() {
    if (started || !canAnimate || !fig.clientWidth) return;
    started = true;
    try {
      if (!window.ScrollTrigger || !gsap.matchMedia) throw new Error("no scroll plugin");
      if (!gsap.core.globals().ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(build);
    } catch (e) {
      plain();
    }
  }

  // never leave the picture hidden: every piece shown as it is
  function plain() {
    show();
    fig.classList.add("is-in");
    [].forEach.call(q("[data-ov]"), function (el) { el.classList.add("is-in"); });
    if (phone) phone.classList.add("is-in");
  }

  // the runway: scrubbed to the scroll, linear, transform and opacity only
  function runway() {
    if (!canAnimate || !window.ScrollTrigger || !gsap.matchMedia) return;
    try {
      if (!gsap.core.globals().ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
      mm = gsap.matchMedia();
      mm.add(DESKTOP, function () {
        // the run is at least half a screen long, so the headline has room to recede even when the picture barely overruns its window
        var run = function () { return Math.max(Math.round(dist * scale), Math.round(window.innerHeight * 0.5)); };
        var tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: hero, start: "top 88px", end: function () { return "+=" + run(); },
            pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 2, // refreshed first: the pins below it are measured with its spacer in place
            onUpdate: function (self) { reveal(y0 + self.progress * dist); },
            onToggle: function (self) { fig.classList.toggle("is-live", self.isActive); }
          }
        });
        // only the main column runs; the sidebar stays put
        tl.fromTo(main, { y: function () { return -y0; } }, { y: function () { return -(y0 + dist); }, duration: 1 }, 0);
        tl.fromTo(headText, { opacity: 1 }, { opacity: 0.55, duration: 0.3 }, 0); // the headline recedes (large text stays above 3:1); the sentence and the button keep their strength
        fig.classList.add("is-run");
        win.removeAttribute("tabindex"); // not a scroller while the page's scroll drives it
        return function () {
          fig.classList.remove("is-run", "is-live");
          win.setAttribute("tabindex", "0");
        };
      });
      mm.add("(max-width: 63.99rem)", function () {
        if (phone) {
          // the phone is painted from the start (so the page's largest paint is not held back by this script) and sits under the load intro's cover; its entrance is held until the cover starts to lift
          var enter = gsap.fromTo(phone, { opacity: 0, y: 48, rotationX: -12, transformPerspective: 900 }, {
            opacity: 1, y: 0, rotationX: 0, duration: 0.9, delay: 0.05, ease: "expo.out", paused: true, immediateRender: false,
            onComplete: function () { gsap.set(phone, { clearProps: "opacity,transform" }); phone.classList.add("is-in"); }
          });
          afterIntro(function () { enter.play(); });
        }
        // flat at the top of the page; it turns as the hero scrolls away
        gsap.fromTo(visual, { rotationY: 0, transformPerspective: 1000 }, { rotationY: 12, ease: "none", immediateRender: false, scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
      });
    } catch (e) {
      plain();
      playLazy();
    }
  }

  // "reduce motion" turning on: everything is reverted and shown as it is, and the window is a plain scrollable region again
  function onMotion() {
    if (!still.matches) return;
    canAnimate = false;
    if (mm) mm.revert();
    if (ctx) ctx.revert();
    mm = ctx = null;
    fig.classList.remove("is-run", "is-live");
    win.setAttribute("tabindex", "0");
    document.documentElement.classList.remove("js");
    plain();
    y0 = 0; scale = 0; // fit again without the start offset
    update();
  }

  function update() { fit(); start(); }

  if (!canAnimate) show();
  if (still && still.addEventListener) still.addEventListener("change", onMotion);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(update);
    ro.observe(fig);
    ro.observe(frame);
  }
  window.addEventListener("resize", update); // the slot is the window's size once the hero hugs it, so a taller or shorter screen alone changes nothing the observers see
  update();
  runway();
  // no pinned runway to bring the lower parts in (no scroll plugin): play them with the rest
  if (started && !(window.ScrollTrigger && gsap.matchMedia)) playLazy();
  // measured once the faces are in: the text lines wrap differently in the last face
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { scale = 0; update(); });
})();
