(function () {

  function hrefSelector(filter) {
    return '[href^="' + filter + '"]';
  }

  var filterURL = 'https://goauthentik.io'
  AKUtils.querySelectorPromise(hrefSelector(filterURL)).then(() => {
    for (var filter of [filterURL, 'https://unsplash.com']) {
      var selector = hrefSelector(filter);
      AKUtils.addRootListener(root => {
        AKUtils.querySelectorAllNative(selector, root).map(v => v.parentElement).forEach(parentElement => {
          console.debug('removing', parentElement);
          parentElement.remove();
        });
      });
    }
  });

})()

