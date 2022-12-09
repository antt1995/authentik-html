class _AKUtils {

  #CUSTOM_CSS_URL = '/static/dist/custom.css'

  #roots = [document.documentElement];
  #listenerContexts = []
  #cssURLs = []

  constructor(injectURLs) {
    if (_AKUtils._instance)
      throw new Error('AKUtils already instantiated')
    _AKUtils._instance = this;
    this.#monitorRoots();
    this.#removeBranding();
    this.#loadScripts(injectURLs);
    console.log('AKUtils', 'loaded')
  }

  isElementNode(node) {
    return node &&
      node.nodeType === Node.ELEMENT_NODE;
  }

  isShadowRootNode(node) {
    return node &&
      node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
      node.host != null &&
      node.host.shadowRoot === node &&
      !Object.keys(node)
        .find(v => v.includes('shady'));
  }

  addRootListener(listener) {
    if (!this.#listenerContexts.find(v => v.listener == listener)) this.#listenerContexts.push({ listener: listener, nodes: [] })
    this.#notifyRootListeners();
  };

  querySelectorNative(selector, root) {
    if (root == null) root = document;
    if (!root.__shady_native_querySelector)
      return root.querySelector(selector);
    else
      return root.__shady_native_querySelector(selector);
  }

  querySelectorAllNative(selector, root) {
    if (root == null) root = document;
    if (!root.__shady_native_querySelectorAll)
      return root.querySelectorAll(selector);
    else
      return root.__shady_native_querySelectorAll(selector);
  }

  querySelectorPromise(selector) {
    return new Promise((resolve) => {
      var resolved = false;
      var resolveWrapper = v => {
        resolved = true;
        resolve(v);
      }
      this.addRootListener(root => {
        var tryResolve = () => {
          if (resolved)
            return true;
          let el = this.querySelectorNative(selector, root);
          if (el) {
            resolveWrapper(el);
            return true;
          }
          return false;
        }
        if (tryResolve()) return;
        var observer = new MutationObserver((mutationRecords, observer) => {
          var element = this.querySelectorNative(selector, root);
          if (element != null) {
            resolveWrapper(element);
            observer.disconnect();
          }
        })
          .observe(root, {
            attributes: true,
            childList: true,
            subtree: true
          });
        if (tryResolve()) observer.disconnect();

      });
    });
  }

  #removeBranding(root) {
    if (root == null) root = document;
    var hrefSelector = (filter) => 'a[href^="' + filter + '"]';
    var filters = ['https://goauthentik.io', 'https://unsplash.com']
    var css = filters.map(hrefSelector).map(v => v + ' { display:none !important }').join('\n');
    var cssTextNode = document.createTextNode(css);
    var style = document.createElement('style');
    style.appendChild(cssTextNode);
    (root.head || root).prepend(style);
    this.querySelectorPromise(hrefSelector(filters[0])).then(() => {
      for (var filter of filters) {
        var selector = hrefSelector(filter);
        this.addRootListener(root => {
          this.querySelectorAllNative(selector, root).forEach(element => {
            var parentElement = element;
            console.debug('removing', parentElement);
            parentElement.remove();
          });
        });
      }
    });
  }

  #loadScripts(injectURLs) {
    var urls = (injectURLs == null) ? [] : injectURLs.split(/[ ,]+/).map(v => v.trim()).filter(injectURL => {
      return (injectURL.match(/:\/\//g) || []).length == 1;
    });
    for (var url of urls) {
      if (url.endsWith(".css"))
        this.#cssURLs.push(url);
      else {
        var script = document.createElement('script');
        script.src = url;
        document.head.appendChild(script);
      }
    }
    this.addRootListener(root => {
      var hrefs = this.#cssURLs;
      if (document.documentElement === root)
        root = document;
      else
        hrefs = hrefs.concat(this.#CUSTOM_CSS_URL);
      for (var href of hrefs) {
        var link = document.createElement('link');
        link.rel = 'stylesheet'
        link.type = 'text/css';
        link.href = href;
        (root.head || root).prepend(link);
      }
    });
  }

  #notifyRootListeners() {
    for (var observedNode of this.#roots) {
      for (var listenerContext of this.#listenerContexts) {
        if (listenerContext.nodes.indexOf(observedNode) === -1) {
          listenerContext.nodes.push(observedNode);
          listenerContext.listener(observedNode);
        }
      }
    }
  }

  #monitorRoots() {
    var roots = this.#roots;
    var isShadowRootNode = this.isShadowRootNode;
    var notifyRootListeners = this.#notifyRootListeners;
    function addShadowRoot(root) {
      if (root == null || roots.indexOf(root) !== -1 || !isShadowRootNode(root)) return;
      console.debug('shadow root discovered', root.host, root);
      roots.push(root);
      notifyRootListeners();
    }
    var attachShadowNative = HTMLElement.prototype.attachShadow
    HTMLElement.prototype.attachShadow = function () {
      console.log('attach shadow start')
      var sh = attachShadowNative.apply(this, arguments)
      addShadowRoot(sh.shadowRoot);
      console.log('attach shadow end')
      return sh;
    }
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      var ni = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, v => isShadowRootNode(v.shadowRoot));
      var sh;
      while (sh = ni.nextNode())
        addShadowRoot(sh.shadowRoot);
    }
  }

}
window.AKUtils = new _AKUtils('{{AUTHENTIK_INJECT_URLS}}');
