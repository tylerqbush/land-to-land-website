(function () {
  'use strict';

  var STORAGE_KEY = 'sale-banner-dismissed-2026-07';
  var banner = document.getElementById('sale-banner');
  if (!banner) return;

  if (localStorage.getItem(STORAGE_KEY) === '1') {
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
      localStorage.setItem(STORAGE_KEY, '1');
      banner.remove();
      document.body.classList.remove('has-sale-banner');
    });
  }
})();
