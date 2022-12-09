class _AKUtils {

  #CUSTOM_CSS_URL = '/static/dist/custom.css'

  #observedNodes = [];
  #listenerContexts = []
  #cssURLs = []

  constructor(injectURLs) {
    if (_AKUtils._instance)
      throw new Error('AKUtils already instantiated')
    _AKUtils._instance = this;
    this.#removeBranding();
    this.#monitorRoots(document.documentElement);
    this.#loadScripts(injectURLs);
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
    for (var observedNode of this.#observedNodes) {
      for (var listenerContext of this.#listenerContexts) {
        if (listenerContext.nodes.indexOf(observedNode) === -1) {
          listenerContext.nodes.push(observedNode);
          listenerContext.listener(observedNode);
        }
      }
    }
  }

  #rootObserver(node, callback) {
    if (!this.isElementNode(node) && !this.isShadowRootNode(node))
      return;
    if (callback == null)
      return;
    let observeCallback = (mutations) => {
      var nodes = mutations
        .flatMap(mutation => Array.from(mutation.addedNodes).concat(mutation.target))
        .filter(v => v != null)
        .map(v => v.shadowRoot)
        .filter(this.isShadowRootNode)
        .filter(v => this.#observedNodes.indexOf(v) === -1);
      nodes.forEach(callback);
    };
    var observeOptions = { attributes: true, childList: true, subtree: true };
    try {
      new MutationObserver(observeCallback)
        .observe(node, observeOptions);
    } catch (e) {
      console.error('observe failed', node, e);
    }
  }

  #shadowRootProducer(node) {
    var ni = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT, v => this.isShadowRootNode(v.shadowRoot));
    return () => {
      var next = ni.nextNode();
      if (next == null)
        return;
      return next.shadowRoot;
    };
  }

  #monitorRoots(node) {
    if (this.#observedNodes.indexOf(node) === -1) {
      this.#observedNodes.push(node);
      if (this.isShadowRootNode(node))
        console.debug('shadow root discovered', node.host, node);
      this.#notifyRootListeners();
      this.#rootObserver(node, root => this.#monitorRoots(root));
    }
    var producer = this.#shadowRootProducer(node);
    var root;
    while (root = producer()) {
      if (root != node)
        this.#monitorRoots(root);
    }
  }
}
(function () {
  var initAKUtils = () => window.AKUtils = new _AKUtils('{{AUTHENTIK_INJECT_URLS}}');
  if (document.readyState === "complete" || document.readyState === "interactive")
    initAKUtils();
  else
    document.addEventListener('DOMContentLoaded', initAKUtils);
})()