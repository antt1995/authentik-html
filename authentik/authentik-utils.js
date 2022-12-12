class _AKUtils {

  #CUSTOM_CSS_URL = '/static/dist/custom.css'

  #roots = [document.documentElement];
  #listenerContexts = []

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

  #loadScripts(injectURLs) {
    var urls = (injectURLs == null) ? [] : injectURLs.split(/[ ,]+/).map(v => v.trim()).filter(injectURL => {
      return (injectURL.match(/:\/\//g) || []).length == 1;
    });
    for (var url of urls) {
      var script = document.createElement('script');
      script.src = url;
      document.head.appendChild(script);
    }
    this.addRootListener(root => {
      if (document.documentElement === root) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet'
      link.type = 'text/css';
      link.href = this.#CUSTOM_CSS_URL;
      this.#prependRoot(root, link);
    });
  }

  #removeBranding() {
    for (var filter of ['https://goauthentik.io', 'https://unsplash.com']) {
      var selector = 'a[href^="' + filter + '"]';
      this.querySelectorPromise(selector).then(element => {
        console.debug('removing', element.parentElement);
        element.parentElement.remove();
      });
    }
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
    var addShadowRoot = (root) => {
      if (root == null || this.#roots.indexOf(root) !== -1 || !this.isShadowRootNode(root)) return;
      console.debug('shadow root discovered', root.host, root);
      this.#roots.push(root);
      this.#notifyRootListeners();
    }
    var attachShadowNative = HTMLElement.prototype.attachShadow
    HTMLElement.prototype.attachShadow = function () {
      var shadowRoot = attachShadowNative.apply(this, arguments)
      addShadowRoot(shadowRoot);
      return shadowRoot;
    }
    for (var i = 0; i < this.#roots.length; i++) {
      var root = this.#roots[i];
      var ni = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, v => this.isShadowRootNode(v.shadowRoot));
      var shadowHost;
      while (shadowHost = ni.nextNode())
        addShadowRoot(shadowHost.shadowRoot);
    }
  }

  #prependRoot(root, element) {
    if (root === document.documentElement) root = document;
    var parent = root.head || this.querySelectorNative('head', root) || root;
    parent.prepend(element);
  }

}
window.AKUtils = new _AKUtils('{{AUTHENTIK_INJECT_JS_URLS}}');
