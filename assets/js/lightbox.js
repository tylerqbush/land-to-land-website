(function () {
  'use strict';

  var triggers = document.querySelectorAll('.js-lightbox-trigger');
  var modal = document.getElementById('photo-lightbox');
  if (!triggers.length || !modal) return;

  var imgEl = modal.querySelector('.lightbox-img');
  var captionEl = modal.querySelector('.lightbox-caption');
  var closeBtn = modal.querySelector('.lightbox-close');
  var prevBtn = modal.querySelector('.lightbox-prev');
  var nextBtn = modal.querySelector('.lightbox-next');

  var photos = [];
  var index = 0;

  function render() {
    var total = photos.length;
    imgEl.src = photos[index];
    imgEl.alt = 'Property Image ' + (index + 1);
    captionEl.textContent = 'Property Image ' + (index + 1) + ' (' + (index + 1) + ' / ' + total + ')';
  }

  function open(startIndex, photoList) {
    photos = photoList;
    index = startIndex;
    render();
    modal.hidden = false;
  }

  function close() {
    modal.hidden = true;
  }

  function showPrev() {
    index = (index - 1 + photos.length) % photos.length;
    render();
  }

  function showNext() {
    index = (index + 1) % photos.length;
    render();
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      var photoList;
      try {
        photoList = JSON.parse(trigger.getAttribute('data-photos'));
      } catch (err) {
        return; // malformed data, let the link's default href behavior proceed
      }
      e.preventDefault();
      var startIndex = parseInt(trigger.getAttribute('data-index'), 10);
      open(startIndex, photoList);
    });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) close();
  });

  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });
})();
