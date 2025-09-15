// /public/js/cms.js
(function () {
  if (!window.CMS_PAGE_SLUG) {
    console.warn('[CMS] window.CMS_PAGE_SLUG is missing on this page.');
    return;
  }
  var url = "/api/pages/" + encodeURIComponent(window.CMS_PAGE_SLUG) + "?r=" + Date.now();

  fetch(url, { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var sections = (data && data.sections) || {};
      // Fill elements
      document.querySelectorAll("[data-cms]").forEach(function (el) {
        var k = el.getAttribute("data-cms");
        if (k && sections.hasOwnProperty(k)) {
          el.innerHTML = sections[k];
        }
      });
      // Quick visibility/logging to help spot mismatches
      var keysOnPage = Array.from(document.querySelectorAll("[data-cms]")).map(function (el){ return el.getAttribute("data-cms"); });
      var serverKeys = Object.keys(sections);
      var missing = serverKeys.filter(function (k){ return !keysOnPage.includes(k); });
      if (missing.length) {
        console.warn("[CMS] Keys saved in DB but not found on this page:", missing);
      }
    })
    .catch(function (err) {
      console.warn("[CMS] Fetch failed:", err);
    });
})();
