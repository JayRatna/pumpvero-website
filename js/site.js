/* Page chrome and the page's own scroll pieces.
   - The phone bar (WhatsApp button) slides in once the hero's button has left the screen, and steps aside while the close section's button is on screen.
   Scroll pieces (GSAP + ScrollTrigger, vendored; transform, opacity and clip-path only):
   - The load intro: a cover on the paper; the V's right arm starts at the far end of the name and sweeps back with the left arm to lock into the V, the gold bars glow, the name wipes out, and
     the logo floats into the header's brand and takes its place, in about 1.8 s. Any touch, key, wheel or click skips it (a 0.15 s fade). Only under html.js (never with "reduce motion",
     never without script); it is skipped when it could not start within 1.2 s of the page load; css/site.css fades the cover out at 2.4 s if this file never ran, and the header brand
     is hidden only while html has .intro-on, which always comes off.
   - Progress spine (64rem and up): a 2px rule at the left edge, its gold fill growing with the page's scroll.
   - The problem, a pinned chapter (64rem and up): the section is held for about 1.5 screens; the first message is already there, and the next three and the line under the thread are each
     sent as one short move when the scroll passes their mark (scrolling back un-sends them). On phones nothing is pinned: each message, and the line, arrives as it comes up the screen.
   - The feature panels assemble as they come into view: a staggered rise, the seams drawing in.
   - The close: the big head is wiped in by the scroll (a scrubbed clip-path inset) on 40rem and up; its right side rises in.
   The hero (js/overview.js) and the phone tour (js/tour.js) run themselves.
   One gsap.context; it is reverted, and the page goes plain, when "reduce motion" turns on. Nothing moves under "reduce motion" (the bar still appears, without sliding);
   if GSAP is missing or this throws, the page is shown as it is. */
(function () {
  "use strict";
  window.pvSite = 1; // the head script drops html.js on load if this file never ran
  var root = document.documentElement;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  root.setAttribute("data-js", ""); // CSS shows the phone bar only when this script ran

  // phone bar: needs no GSAP. CSS keeps it hidden until .is-on is added.
  var bar = document.getElementById("sticky");
  var heroBtn = document.querySelector(".hero .btn");
  var closeBtn = document.querySelector(".cta .btn");
  var foot = document.querySelector(".site-footer");
  if (bar && heroBtn && closeBtn && foot && "IntersectionObserver" in window) {
    var past = false, atClose = false, atFoot = false;
    var sync = function () { bar.classList.toggle("is-on", past && !atClose && !atFoot); };
    new IntersectionObserver(function (e) {
      var r = e[e.length - 1];
      past = !r.isIntersecting && r.boundingClientRect.bottom < 0;
      sync();
    }).observe(heroBtn);
    // the margin makes the bar step aside a little before the close button reaches the bottom edge
    new IntersectionObserver(function (e) {
      atClose = e[e.length - 1].isIntersecting;
      sync();
    }, { rootMargin: "0px 0px 96px 0px" }).observe(closeBtn);
    // and it stays aside while any of the footer shows, so it never covers footer content and the footer needs no room for it
    new IntersectionObserver(function (e) {
      atFoot = e[e.length - 1].isIntersecting;
      sync();
    }).observe(foot);
  }

  if (still.matches) return;
  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove("js"); return; }

  var ctx = null, mm = null;

  var introEnd = null; // ends the intro at once, whatever state it is in
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return gsap.utils.toArray(sel); }
  function once(el) { return { trigger: el, start: "top 88%", once: true }; }

  function spine() {
    var fill = $(".spine i");
    if (!fill) return;
    gsap.to(fill, { scaleY: 1, ease: "none", scrollTrigger: { trigger: document.documentElement, start: 0, end: "max", scrub: true } });
  }

  // the load intro. The cover shows the logo's right arm at the far end of where the name will be and the left arm a little left of its place; they sweep back together into the V, the frame
  // closes around them, the two gold bars light up in a soft glow and the name wipes out; then the lockup floats to the header's real brand, the cover's background clears behind it, and the
  // brand takes its place on the landing frame (no crossfade: the lockup is pixel-aligned, so a swap cannot be seen). One timeline, about 1.8 s, built paused and played once the page's
  // scripts have all run and a frame has painted, so the opening split is seen even on a slow phone. If that moment comes later than LATE ms the page is shown at once instead.
  // A skip kills the timeline and fades the cover out in 0.15 s. The header's brand is hidden only while html has .intro-on; end() always removes that, the cover and the listeners,
  // whether the timeline finishes, is skipped, throws or never gets its frames (a timer ends it 2.4 s after it starts). Until the timeline plays, css/site.css fades the cover out at 2.4 s.
  var LATE = 1200; // ms from the start of the page load
  function intro() {
    var cover = document.getElementById("intro"), brand = $(".site-header .brand");
    if (!cover) return;
    var keys = ["pointerdown", "keydown", "wheel", "touchstart"], tl = null, timer = 0, over = false, skipped = false, spot = null, lock;
    function end() {
      if (over) return;
      over = true;
      clearTimeout(timer);
      keys.forEach(function (k) { window.removeEventListener(k, skip); });
      if (tl) tl.kill();
      if (brand) { // the markup has no inline style on the brand; GSAP's are all gone (the second pass takes away the empty attribute a browser can leave behind)
        gsap.set(brand, { clearProps: "all" });
        brand.removeAttribute("style");
        setTimeout(function () { if (!brand.getAttribute("style")) brand.removeAttribute("style"); }, 120);
      }
      root.classList.remove("intro-on");
      if (cover.parentNode) cover.parentNode.removeChild(cover);
      introEnd = null;
      fly(); // whatever ended it, the page's own entrances may start now
      window.dispatchEvent(new Event("pvintro"));
    }
    function fly() { // the cover's background starts to clear: the hero's own entrance (js/overview.js) starts, so it is seen as the page appears
      if (window.pvFlyDone) return;
      window.pvFlyDone = true;
      window.dispatchEvent(new Event("pvfly"));
    }
    function skip() {
      keys.forEach(function (k) { window.removeEventListener(k, skip); });
      if (over) return;
      skipped = true;
      if (tl) tl.kill();
      fly();
      cover.style.animation = "none"; // the CSS fallback must not fight the fade
      if (brand) gsap.set(brand, { opacity: 1 });
      gsap.to(cover, { opacity: 0, duration: 0.15, ease: "none", onComplete: end });
    }
    // where the lockup must land: the header brand's mark, as it is now
    function land() {
      if (!spot) {
        var a = brand.querySelector("svg").getBoundingClientRect(), b = lock.querySelector("svg").getBoundingClientRect();
        spot = { s: a.width / b.width, x: a.left - b.left, y: a.top - b.top };
      }
      return spot;
    }
    function begin() { // all the page's scripts have run and a frame has painted
      if (over || skipped) return;
      if (performance.now() > LATE) { end(); return; } // too late to be worth it: the page is shown as it is
      cover.style.animation = "none"; // from here the timer guards the intro; the CSS fallback is only for a script that never ran
      root.classList.add("intro-on");
      tl.play(0);
      timer = setTimeout(end, 2400);
    }
    introEnd = end;
    if (root.classList.contains("no-intro")) { end(); return; } // a slow start: the page's own script has already dropped the cover
    try {
      if (!brand) throw new Error("no brand to land on");
      lock = cover.querySelector(".intro-logo");
      var bg = cover.querySelector(".intro-bg"), word = lock.querySelector(".in-word"), glow = lock.querySelector(".intro-glow");
      var arms = $$("#intro .in-arm"), bars = $$("#intro .in-bar"), frame = $("#intro .in-frame");
      // the lockup is laid out; the right arm starts where the name ends (in the SVG's own units: its outer edge, x = 78, goes to the far edge of "PumpVero")
      var mark = lock.querySelector("svg").getBoundingClientRect(), name = word.getBoundingClientRect(), unit = mark.width / 86;
      var far = Math.round((name.right - mark.left - (78 - 7) * unit) / unit);
      tl = gsap.timeline({ paused: true, onComplete: end });
      // 0 to 0.1: the right arm stands at the far end of the name and the left arm a little left of its place, both leaning away from the centre (pivoting on the V's point)
      // 0.1 to 0.75: the right arm sweeps back across the name's span, the left one returns, and they lock into the V
      tl.fromTo(arms[0], { opacity: 1, x: -14, rotation: -9, svgOrigin: "48 72" }, { x: 0, rotation: 0, duration: 0.65, ease: "power3.inOut" }, 0.1);
      tl.fromTo(arms[1], { opacity: 1, x: far, rotation: 9, svgOrigin: "52 72" }, { x: 0, rotation: 0, duration: 0.65, ease: "power3.inOut" }, 0.1);
      // the frame closes around them as they lock
      tl.fromTo(frame, { opacity: 0, scale: 0.96, svgOrigin: "50 50" }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, 0.55);
      // 0.7 to 1.0: the two gold bars light up, with a soft gold glow behind them (opacity and scale only) that eases down and goes out in the flight
      tl.fromTo(bars, { opacity: 0, scaleY: 0.6, transformOrigin: "50% 100%" }, { opacity: 1, scaleY: 1, duration: 0.25, stagger: 0.05, ease: "power2.out" }, 0.7);
      tl.fromTo(glow, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1.1, duration: 0.3, ease: "power2.out" }, 0.7);
      tl.to(glow, { opacity: 0.7, duration: 0.25, ease: "sine.inOut" }, 1.0);
      tl.to(glow, { opacity: 0, duration: 0.5, ease: "power1.in" }, 1.25);
      // 0.95 to 1.25: the name wipes out from the mark's left edge
      tl.fromTo(word, { clipPath: "inset(-5% 100% -5% -2%)", x: -12 }, { clipPath: "inset(-5% -2% -5% -2%)", x: 0, duration: 0.3, ease: "power2.out" }, 0.95);
      // 1.25 to 1.8: the whole lockup floats to the header brand (one uniform scale). Where it lands is measured a moment earlier, so the flight starts on a light frame.
      tl.call(land, null, 1.2);
      tl.to(lock, { x: function () { return land().x; }, y: function () { return land().y; }, scale: function () { return land().s; }, transformOrigin: "0 0", duration: 0.55, ease: "power3.inOut" }, 1.25);
      // the cover's background is held until the lockup has cleared the headline, then clears with an exit ease; the hero's own entrance starts as it does
      tl.to(bg, { opacity: 0, duration: 0.45, ease: "power2.in" }, 1.35);
      tl.call(fly, null, 1.45);
      // on the landing frame the header's brand takes over from the lockup, and end() takes the cover away on the same tick
      tl.set(brand, { opacity: 1 }, 1.8);
      keys.forEach(function (k) { window.addEventListener(k, skip, { passive: true }); });
      var go = function () { requestAnimationFrame(begin); };
      if (document.readyState === "complete") go(); else document.addEventListener("DOMContentLoaded", go, { once: true });
    } catch (e) {
      end();
    }
  }

  // the problem: the owner's messages to his manager
  var SEND = [0.26, 0.44, 0.66, 0.86]; // where on the pin the 2nd, 3rd and 4th message and the closing line arrive (0 to 1); the first is on the page when the band arrives
  function problem() {
    var sec = $(".problem"), thread = $(".thread"), msgs = $$(".thread-msgs li"), line = $(".problem-line");
    if (!sec || !thread || !msgs.length) return;
    mm.add("(min-width: 64rem)", function () {
      // each message is sent as one short move of its own, from its bottom right corner, played as the scroll passes its mark and reversed as it goes back past it (the scroll never scrubs half a message)
      var sends = msgs.slice(1).map(function (li) {
        return gsap.fromTo(li, { opacity: 0, y: 14, scale: 0.94, transformOrigin: "100% 100%" }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "expo.out", paused: true });
      });
      sends.push(gsap.fromTo(line, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out", paused: true }));
      var sent = sends.map(function () { return false; });
      ScrollTrigger.create({
        trigger: sec, start: "top top", end: function () { return "+=" + Math.round(window.innerHeight * 1.5); },
        pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: function (self) {
          for (var i = 0; i < sends.length; i++) {
            var now = self.progress >= SEND[i];
            if (now === sent[i]) continue;
            sent[i] = now;
            if (now) sends[i].play(); else sends[i].reverse();
          }
        }
      });
    });
    mm.add("(max-width: 63.99rem)", function () {
      // each message, and the line, arrives as it comes up the screen (above the phone bar), not all together
      msgs.concat([line]).forEach(function (el) {
        gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 80%", once: true } });
      });
    });
  }

  function panels() {
    var box = $(".panels");
    if (!box) return;
    // two columns and up: one timeline for the whole grid
    mm.add("(min-width: 48rem)", function () {
      var tl = gsap.timeline({ defaults: { ease: "power3.out" }, scrollTrigger: { trigger: box, start: "top 85%", once: true } });
      tl.fromTo($$(".panels li > h3, .panels li > p"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06 }, 0.15);
      tl.fromTo($$(".panels .seam-h"), { scaleX: 0 }, { scaleX: 1, duration: 0.9, stagger: 0.12 }, 0);
      tl.fromTo($$(".panels .seam-v"), { scaleY: 0 }, { scaleY: 1, duration: 0.9, stagger: 0.12 }, 0.1);
    });
    // one column: each panel rises as it comes on screen
    mm.add("(max-width: 47.99rem)", function () {
      $$(".panels li").forEach(function (li) {
        var tl = gsap.timeline({ defaults: { ease: "power3.out" }, scrollTrigger: once(li) });
        var seam = li.querySelectorAll(".seam-h");
        tl.fromTo(li.querySelectorAll("h3, p"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06 }, 0.1);
        if (seam.length) tl.fromTo(seam, { scaleX: 0 }, { scaleX: 1, duration: 0.9 }, 0);
      });
    });
  }

  function close() {
    var h = $(".close-h"), act = $$(".close-act > *");
    if (!h) return;
    mm.add("(min-width: 40rem)", function () {
      // the box is a little loose around the glyphs, so the wipe does not shave the descenders when it has finished
      gsap.fromTo(h, { clipPath: "inset(-10% 100% -20% -2%)" }, { clipPath: "inset(-10% -2% -20% -2%)", ease: "none", scrollTrigger: { trigger: h, start: "clamp(top 88%)", end: "clamp(top 45%)", scrub: true } });
    });
    mm.add("(max-width: 39.99rem)", function () {
      gsap.fromTo(h, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", scrollTrigger: once(h) });
    });
    gsap.fromTo(act, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: ".close-act", start: "top 88%", once: true } });
  }

  function build() {
    if (!gsap.core.globals().ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    mm = gsap.matchMedia();
    ctx = gsap.context(function () { intro(); spine(); problem(); panels(); close(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    // (ScrollTrigger refreshes itself on "load"; a second refresh there only repeated the same layout work)
  }

  // "reduce motion" turning on: everything is reverted, nothing is left hidden or pinned
  function onMotion() {
    if (!still.matches) return;
    if (introEnd) introEnd();
    if (mm) mm.revert();
    if (ctx) ctx.revert();
    mm = ctx = null;
    root.classList.remove("js");
  }

  try {
    build();
    if (still.addEventListener) still.addEventListener("change", onMotion);
  } catch (e) {
    if (mm) mm.revert();
    if (ctx) ctx.revert();
    ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
    root.classList.remove("js");
  }
})();
