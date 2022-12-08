const appendCustomCSS = (el) => {
  console.log("appending css")
  var link = document.createElement('link');
  link.rel = 'stylesheet'
  link.type = 'text/css';
  link.href = '/static/dist/custom.css';
  (el.head || el)
  .prepend(link);
}

(function() {
  addShadowRootListener(appendCustomCSS)
})()
