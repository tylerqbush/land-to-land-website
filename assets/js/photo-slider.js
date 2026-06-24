(function () {
  'use strict';

  var slider = document.querySelector('.photo-slider');
  if (!slider) return;

  var track = slider.querySelector('.photo-slider__track');
  if (!track) return;

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

  var dots = slider.querySelectorAll('.photo-slider__dot');
  var INTERVAL_MS = 4000;
  var TRANSITION_MS = 700;
  var realCount = photos.length;
  var index = 0;

  // Clone the first slide and append it so the track can keep sliding
  // forward past the last real photo, then snap back to slide 0
  // (without a transition) once the clone is fully in view. This is
  // what makes the loop look seamless instead of sliding backwards.
  var firstClone = track.firstElementChild.cloneNode(true);
  track.appendChild(firstClone);

  function setDot(realIndex) {
    dots.forEach(function (dot, i) {
      dot.classList.toggle('photo-slider__dot--active', i === realIndex);
    });
  }

  function goNext() {
    index++;
    track.style.transform = 'translateX(-' + index * 100 + '%)';
    setDot(index % realCount);

    if (index === realCount) {
      setTimeout(function () {
        track.classList.add('photo-slider__track--no-transition');
        track.style.transform = 'translateX(0)';
        index = 0;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            track.classList.remove('photo-slider__track--no-transition');
          });
        });
      }, TRANSITION_MS);
    }
  }

  setInterval(goNext, INTERVAL_MS);
})();
