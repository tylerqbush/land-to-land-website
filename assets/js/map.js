(function () {
  const props = window.PROPERTIES || [];
  if (!props.length) return;

  // Center map on the average of all property coords
  const avgLat = props.reduce((s, p) => s + p.lat, 0) / props.length;
  const avgLng = props.reduce((s, p) => s + p.lng, 0) / props.length;

  const map = L.map("property-map").setView([avgLat, avgLng], 4);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Esri World Imagery" }
  ).addTo(map);

  props.forEach(function (p) {
    if (!p.lat || !p.lng) return;

    var marker = L.circleMarker([p.lat, p.lng], {
      radius: 12,
      fillColor: "#8BC83F",
      color: "#0D2600",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    });

    marker.bindPopup(
      '<strong style="color:#1F4C6B;">$' +
        p.monthly +
        '/mo</strong><br>' +
        p.acreage +
        " ac · " +
        p.county +
        " Co, " +
        p.state +
        '<br><a href="/property/' +
        p.slug +
        '/" style="color:#1F4C6B;font-weight:700;">View Listing &rarr;</a>'
    );

    marker.addTo(map);
  });

  // Filter integration: re-render map markers on filter change
  document.querySelectorAll(".filter-bar select").forEach(function (sel) {
    sel.addEventListener("change", function () {
      var state = document.getElementById("filter-state").value;
      var county = document.getElementById("filter-county").value;
      var status = document.getElementById("filter-status").value;

      document.querySelectorAll(".property-card").forEach(function (card) {
        var show =
          (!state || card.dataset.state === state) &&
          (!county || card.dataset.county === county) &&
          (!status || card.dataset.status === status);
        card.style.display = show ? "" : "none";
      });
    });
  });
})();
