(function () {
  'use strict';

  var slider = document.querySelector('.photo-slider');
  if (!slider) return;

  var img = slider.querySelector('img');
  if (!img) return;

  var photos;
  try {
    photos = JSON.parse(slider.getAttribute('data-photos'));
  } catch (err) {
    return;
  }
  if (!Array.isArray(photos) || photos.length < 2) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  var INTERVAL_MS = 4000;
  var FADE_MS = 500;
  var index = 0;

  setInterval(function () {
    index = (index + 1) % photos.length;
    img.style.opacity = '0';
    setTimeout(function () {
      img.src = photos[index];
      img.style.opacity = '1';
    }, FADE_MS);
  }, INTERVAL_MS);
})();
