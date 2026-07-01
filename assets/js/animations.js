(function () {
  'use strict';

  // ── NAV: hamburger drawer toggle ────────────────────────
  var navToggle = document.querySelector('[data-nav-toggle]');
  var navBackdrop = document.querySelector('[data-nav-backdrop]');
  if (navToggle) {
    var drawer = document.getElementById(navToggle.getAttribute('data-nav-toggle'));

    function closeDrawer() {
      if (drawer) drawer.classList.remove('open');
      if (navBackdrop) navBackdrop.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    }

    function openDrawer() {
      if (drawer) drawer.classList.add('open');
      if (navBackdrop) navBackdrop.classList.add('open');
      navToggle.classList.add('open');
      navToggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-open');
    }

    navToggle.addEventListener('click', function () {
      if (navToggle.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    if (navBackdrop) navBackdrop.addEventListener('click', closeDrawer);
  }

  // ── FADE-UP: IntersectionObserver ───────────────────────
  var fadeEls = document.querySelectorAll('.fade-up');
  if (fadeEls.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-up--visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    fadeEls.forEach(function (el) { observer.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add('fade-up--visible'); });
  }

  // ── STATS COUNT-UP ──────────────────────────────────────
  var countEls = document.querySelectorAll('.stat-item__num[data-count]');
  if (countEls.length && 'IntersectionObserver' in window) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseFloat(el.dataset.count);
        var prefix = el.dataset.prefix || '';
        var suffix = el.dataset.suffix || '';
        var start = performance.now();
        var duration = 1600;
        function tick(now) {
          var p = Math.min((now - start) / duration, 1);
          var ease = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + Math.round(target * ease) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        countObserver.unobserve(el);
      });
    }, { threshold: 0.5 });
    countEls.forEach(function (el) { countObserver.observe(el); });
  }

})();
