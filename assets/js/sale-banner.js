(function () {
  'use strict';

  var banner = document.getElementById('sale-banner');
  if (!banner) return;
  // Keyed by phase so dismissing the teaser doesn't hide the live sale.
  var STORAGE_KEY = 'sale-banner-dismissed-2026-bf-' + (banner.getAttribute('data-sale-phase') || '');

  if ((function () { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; } })()) {
    banner.remove();
    document.body.classList.remove('has-sale-banner');
    return;
  }

  function setBannerHeight() {
    document.documentElement.style.setProperty('--sale-banner-height', banner.offsetHeight + 'px');
  }
  setBannerHeight();
  window.addEventListener('resize', setBannerHeight);

  var closeBtn = banner.querySelector('[data-sale-dismiss]');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
      banner.remove();
      document.body.classList.remove('has-sale-banner');
    });
  }
})();
