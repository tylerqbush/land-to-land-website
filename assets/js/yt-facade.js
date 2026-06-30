(function () {
  'use strict';

  document.querySelectorAll('.yt-facade').forEach(function (el) {
    function load() {
      var iframe = document.createElement('iframe');
      iframe.src = el.dataset.src;
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.cssText = 'border:0;display:block;width:100%;height:100%;';
      el.replaceWith(iframe);
    }
    el.addEventListener('click', load);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') load(); });
  });
})();
