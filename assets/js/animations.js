(function () {
  'use strict';

  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  // ── NAV: hide on scroll down, reveal on scroll up ──────
  var nav = document.querySelector('.site-nav');
  if (nav) {
    var lastDir = 0;
    ScrollTrigger.create({
      start: 120,
      onUpdate: function (self) {
        if (self.direction === 1 && lastDir !== 1 && self.scroll() > 120) {
          gsap.to(nav, { yPercent: -100, duration: 0.35, ease: 'power2.in', overwrite: true });
          lastDir = 1;
        } else if (self.direction === -1 && lastDir !== -1) {
          gsap.to(nav, { yPercent: 0, duration: 0.35, ease: 'power2.out', overwrite: true });
          lastDir = -1;
        }
      }
    });
  }

  // ── HERO: line reveal + parallax (home page only) ──────
  var hero = document.querySelector('.hero');
  if (hero) {

    // Enable overflow clip on line wraps (progressive enhancement only)
    document.querySelectorAll('.hero__line-wrap').forEach(function (el) {
      el.style.overflow = 'hidden';
      el.style.display = 'block';
    });

    // Parallax on hero bg
    gsap.to('.hero__bg', {
      y: '22%',
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    // Entrance timeline
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.15 });

    tl.from('.hero__eyebrow', { y: 24, opacity: 0, duration: 0.7 })
      .from('.hero__line', { y: '108%', duration: 1.05, stagger: 0.13 }, '-=0.35')
      .from('.hero__sub', { y: 22, opacity: 0, duration: 0.75 }, '-=0.55')
      .from('.hero__pill', { y: 14, opacity: 0, duration: 0.5, stagger: 0.07 }, '-=0.5')
      .from('.hero__actions > *', { y: 14, opacity: 0, duration: 0.5, stagger: 0.1 }, '-=0.4')
      .from('.hero__scroll', { opacity: 0, duration: 1.0 }, '-=0.2');
  }

  // ── STATS COUNT-UP ──────────────────────────────────────
  document.querySelectorAll('.stat-item__num[data-count]').forEach(function (el) {
    var target = parseFloat(el.dataset.count);
    var prefix = el.dataset.prefix || '';
    var suffix = el.dataset.suffix || '';
    var obj = { val: 0 };

    gsap.to(obj, {
      val: target,
      duration: 1.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        once: true
      },
      onUpdate: function () {
        el.textContent = prefix + Math.round(obj.val) + suffix;
      }
    });
  });

  // ── HORIZONTAL SCROLL: MARKETS (desktop only) ───────────
  var hscroll = document.querySelector('.markets-hscroll');
  if (hscroll && window.matchMedia('(min-width: 900px)').matches) {
    var track = hscroll.querySelector('.markets-track');

    gsap.to(track, {
      x: function () { return -(track.scrollWidth - hscroll.clientWidth); },
      ease: 'none',
      scrollTrigger: {
        trigger: hscroll,
        start: 'top top',
        end: function () { return '+=' + (track.scrollWidth - hscroll.clientWidth); },
        pin: true,
        scrub: 1.2,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    // Subtle card scale on enter
    document.querySelectorAll('.markets-hscroll .market-card').forEach(function (card, i) {
      gsap.from(card, {
        scale: 0.92,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: hscroll,
          start: 'top 80%',
          once: true
        },
        delay: i * 0.12
      });
    });
  }

  // ── SECTION FADE-UP (all pages) ─────────────────────────
  ScrollTrigger.batch('.fade-up', {
    onEnter: function (batch) {
      gsap.from(batch, {
        y: 34,
        opacity: 0,
        duration: 0.75,
        stagger: 0.09,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    },
    start: 'top 88%',
    once: true
  });

})();
