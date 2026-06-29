// LUMINA — home.js
// Homepage animations: hero word-mask, custom cursor, parallax, count-up, image reveals.

(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- Hero headline: word-mask reveal ---- */
  (function(){
    var h1 = document.querySelector('.hero-content h1');
    if(!h1) return;
    if(reduce){ h1.classList.add('split'); return; }
    var nodes = Array.prototype.slice.call(h1.childNodes);
    var html = '', i = 0;
    function words(txt, gold){
      return txt.split(/(\s+)/).map(function(t){
        if(t === '' ) return '';
        if(/^\s+$/.test(t)) return ' ';
        var d = (0.45 + i*0.07).toFixed(2); i++;
        return '<span class="wln"><span class="wln-i'+(gold?' wln-gold':'')+'" style="animation-delay:'+d+'s">'+t+'</span></span>';
      }).join('');
    }
    nodes.forEach(function(n){
      if(n.nodeType === 3){ html += words(n.textContent, false); }
      else if(n.nodeName === 'BR'){ html += '<br>'; }
      else if(n.nodeName === 'EM'){ html += words(n.textContent, true); }
      else { html += words(n.textContent || '', false); }
    });
    h1.innerHTML = html;
    h1.classList.add('split');
  })();

  /* ---- Custom cursor ---- */
  if(fine && !reduce){
    document.body.classList.add('fx-on');
    var ring = document.querySelector('.fx-cursor');
    var dot  = document.querySelector('.fx-cursor-dot');
    var rx=window.innerWidth/2, ry=window.innerHeight/2, tx=rx, ty=ry;
    window.addEventListener('mousemove', function(e){
      tx=e.clientX; ty=e.clientY;
      dot.style.transform='translate('+tx+'px,'+ty+'px) translate(-50%,-50%)';
      ring.classList.add('is-active'); dot.classList.add('is-active');
    });
    (function loop(){
      rx += (tx-rx)*0.18; ry += (ty-ry)*0.18;
      ring.style.transform='translate('+rx+'px,'+ry+'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    var hov = 'a,button,input,select,textarea,.property-card,.location-card,.type-pill';
    document.addEventListener('mouseover', function(e){ if(e.target.closest(hov)) ring.classList.add('is-hover'); });
    document.addEventListener('mouseout',  function(e){ if(e.target.closest(hov)) ring.classList.remove('is-hover'); });
  }

  /* ---- Hero parallax ---- */
  var heroBg = document.querySelector('.hero-bg');
  if(heroBg && !reduce){
    var ticking=false;
    window.addEventListener('scroll', function(){
      if(ticking) return; ticking=true;
      requestAnimationFrame(function(){
        var y = window.scrollY;
        if(y < window.innerHeight){ heroBg.style.backgroundPosition = 'center calc(38% + '+(y*0.06)+'px)'; }
        ticking=false;
      });
    }, {passive:true});
  }

  /* ---- Stat count-up ---- */
  function countUp(el){
    var to = +el.getAttribute('data-to'),
        pre = el.getAttribute('data-prefix')||'',
        suf = el.getAttribute('data-suffix')||'',
        dur = 1700, start = null;
    function tick(now){
      if(!start) start=now;
      var p = Math.min((now-start)/dur, 1), e = 1-Math.pow(1-p,3);
      el.textContent = pre + Math.round(to*e).toLocaleString() + suf;
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var statBar = document.querySelector('.stats-bar');
  if(statBar){
    var sObs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          statBar.querySelectorAll('.stat-number[data-to]').forEach(function(el){ if(!reduce) countUp(el); });
          sObs.disconnect();
        }
      });
    }, {threshold:0.4});
    sObs.observe(statBar);
  }

  /* ---- Scroll image reveals ---- */
  var imgs = [];
  document.querySelectorAll('.card-img img, .why-image img, .location-card-bg').forEach(function(el){ el.classList.add('reveal-img'); imgs.push(el); });
  if(imgs.length){
    var iObs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); iObs.unobserve(en.target); } });
    }, {threshold:0.18});
    imgs.forEach(function(el){ reduce ? el.classList.add('in') : iObs.observe(el); });
  }
})();
