(function () {
  'use strict';

  var selects = document.querySelectorAll('.filter-bar select');
  selects.forEach(function (sel) {
    sel.addEventListener('change', function () {
      var state = document.getElementById('filter-state').value;
      var county = document.getElementById('filter-county').value;
      var status = document.getElementById('filter-status').value;
      document.querySelectorAll('.property-card').forEach(function (card) {
        var show =
          (!state || card.dataset.state === state) &&
          (!county || card.dataset.county === county) &&
          (!status || card.dataset.status === status);
        card.style.display = show ? '' : 'none';
      });
    });
  });
})();
