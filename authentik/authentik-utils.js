class _AKUtils {

  #observedNodes = [];
  #listenerContexts = []


  constructor(scriptURLs) {
    if (_AKUtils._instance)
      throw new Error('AKUtils already instantiated')
    _AKUtils._instance = this;
    this.#monitorRoots(document.documentElement);
    this.#loadScripts(scriptURLs);
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
    if (!this.#listenerContexts.find(v => v.listener == listener)) this.#listenerContexts.push(new this.#ListenerContext(listener))
    this.#notifyRootListeners();
  };

  querySelectorAllNative(root, selector) {
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
        function tryResolve() {
          if (resolved)
            return true;
          let el = root.querySelector(selector);
          if (el) {
            resolveWrapper(el);
            return true;
          }
          return false;
        }
        if (tryResolve()) return;
        var observer = new MutationObserver((mutationRecords, observer) => {
          var element = root.querySelector(selector);
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

  #loadScripts(scriptURLs) {
    if (scriptURLs == null) return;
    var hrefs = scriptURLs.split(/[ ,]+/).map(v => v.trim()).filter(scriptURL => {
      return (scriptURL.match(/:\/\//g) || []).length == 1;
    }).forEach(scruptURL => {
      var script = document.createElement('script');
      script.src = scruptURL;
      document.head.appendChild(script);
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
      var nodes = mutations.flatMap(mutation => {
        return Array.from(mutation.addedNodes)
          .concat(mutation.target);
      })
        .filter(v => v != null)
        .map(v => v.shadowRoot)
        .filter(this.isShadowRootNode);
      nodes.forEach(callback);
    };
    var observeOptions = { attributes: false, childList: true, subtree: true };
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

  static #ListenerContext = class {
    constructor(listener) {
      this.listener = listener;
      this.nodes = [];
    }
  }
}
window.AKUtils = new _AKUtils("{{SCRIPT_URLS}}");
