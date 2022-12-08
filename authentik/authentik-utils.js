
class _AKUtils {

  #observedNodes = [];
  #listenerContexts = []


  constructor() {
    if (_AKUtils._instance)
      throw new Error('AKUtils already instantiated')
    _AKUtils._instance = this;
    this.#monitorRoots(document.documentElement);
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

  querySelectorPromise(selector) {
    return new Promise((resolve) => {
      var resolved = false;
      this.addRootListener(root => this.#querySelectorResolve(root, selector, () => resolved, (result) => {
        resolved = true;
        resolve(result);
      }));
    });
  }

  #querySelectorResolve(root, selector, isResolved, resolve) {
    function tryResolve() {
      if (isResolved())
        return true;
      let el = root.querySelector(selector);
      if (el) {
        resolve(el);
        return true;
      }
      return false;
    }
    if (tryResolve()) return;
    var observer = new MutationObserver((mutationRecords, observer) => {
      var element = root.querySelector(selector);
      if (element != null) {
        resolve(element);
        observer.disconnect();
      }
    })
      .observe(root, {
        attributes: true,
        childList: true,
        subtree: true
      });
    if (tryResolve()) observer.disconnect();
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
    console.log(node)
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
const AKUtils = new _AKUtils();









