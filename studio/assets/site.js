(function(){
  var d=document.documentElement,hd=document.getElementById('hd'),nav=document.getElementById('nav'),bg=document.getElementById('bg');
  if(bg)bg.onclick=function(){var o=nav.classList.toggle('open');bg.setAttribute('aria-expanded',o)};
  if(nav)nav.addEventListener('click',function(e){if(e.target.closest('a')){nav.classList.remove('open');if(bg)bg.setAttribute('aria-expanded',false)}});
  var y=0,always=hd&&hd.hasAttribute('data-solid');
  addEventListener('scroll',function(){var s=scrollY;hd.classList.toggle('solid',always||s>30);hd.classList.toggle('hide',s>y&&s>400&&!nav.classList.contains('open'));y=s},{passive:true});
  var io='IntersectionObserver'in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -6% 0px'}):null;
  document.querySelectorAll('.rv').forEach(function(el){io?io.observe(el):el.classList.add('in')});
})();
