// LUMINA — areas.js
// Loads listing previews for area-specific pages.

(function(){
  var areaEl = document.querySelector('[data-area]');
  if (!areaEl) return;
  var area = areaEl.dataset.area;
  var grid = document.getElementById('listing-preview');
  var formatPrice = function(value) { return Number(value).toLocaleString('en-US') + ' JOD'; };
  var card = function(item) {
    var a = document.createElement('a');
    a.href = 'property-details.html?id=' + encodeURIComponent(item.id);
    a.className = 'preview-card';
    var img = document.createElement('img'); img.src = item.image_url || '/assets/images/hero-luxury-villa.jpg'; img.alt = item.title + ' — demo preview'; img.loading='lazy';
    var body = document.createElement('div'); body.className = 'preview-body';
    var h = document.createElement('h3'); h.textContent = item.title;
    var loc = document.createElement('p'); loc.textContent = item.location_area;
    var price = document.createElement('p'); price.className='preview-price'; price.textContent = formatPrice(item.price_jod_test_margin);
    var status = document.createElement('p'); status.textContent = 'Demo Listing — Verification Required';
    body.append(h, loc, price, status); a.append(img, body); return a;
  };
  fetch('/data/lumina-demo-leads.json').then(function(r){ return r.json(); }).then(function(items){
    var filtered = items.filter(function(item){ return item.location_area && item.location_area.toLowerCase().includes(area); }).slice(0,3);
    grid.replaceChildren.apply(grid, (filtered.length ? filtered : items.slice(0,3)).map(card));
  }).catch(function(){ if(grid) grid.textContent='Listing previews are temporarily unavailable.'; });
})();
