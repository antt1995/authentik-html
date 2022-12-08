const appendCustomCSS(el) {
  var link = document.createElement('link');
  link.type = 'text/css';
  link.href = '/static/dist/custom.css';
  (el.head || el)
  .appendChild(link);
}

(function(){
  addShadowRootListener(appendCustomCSS)
})()
