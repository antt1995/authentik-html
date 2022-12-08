(function() {

  let debugLogEnabled = false;

  function debugLog() {
    if (!debugLogEnabled)
      return;
    arguments = Array.from(arguments);
    if (arguments[1] != null && isShadowRoot(arguments[1]))
      arguments.splice(1, 0, arguments[1].host);
    console.debug.apply(this, arguments);
  }

  function assert(condition, message) {
    if (!!condition)
      return;
    if (arguments.length == 1)
      arguments = ['assertion failed'];
    else {
      arguments = Array.from(arguments);
      arguments.shift();
    }
    throw new Error(arguments);
  }

  let isElementNode = (node) => node &&
    node.nodeType === Node.ELEMENT_NODE

  let isShadowRoot = (node) => node &&
    node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
    node.host != null &&
    node.host.shadowRoot === node &&
    !Object.keys(node)
    .find(v => v.includes('shady'))

  let shadowRootProducer = (node) => {
    if (!isElementNode(node) && !isShadowRoot(node)) return () => {};
    var ni = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT, v => isShadowRoot(v.shadowRoot));
    return () => {
      var next = ni.nextNode();
      if (next == null) return;
      debugLog('produced', next);
      return next.shadowRoot;
    };
  }

  let shadowRootObserver = (node, callback) => {
    if (!isElementNode(node) && !isShadowRoot(node)) return;
    if (callback == null) return;
    debugLog('observing', node);
    let observeCallback = (mutations) => {
      var nodes = mutations.flatMap(mutation => {
          return Array.from(mutation.addedNodes)
            .concat(mutation.target)
        })
        .filter(v => v != null)
        .map(v => v.shadowRoot)
        .filter(isShadowRoot)
        .map(v => {
          debugLog('add mutation', v);
          return v;
        });
      nodes.forEach(callback);
    }
    var observeOptions = {
      attributes: false,
      childList: true,
      subtree: true
    };
    try {
      new MutationObserver(observeCallback)
        .observe(node, observeOptions);
    } catch (e) {
      console.error('observe failed', node, e);
    }
  }

  let observedNodes = []

  let monitorShadowRoots = (node) => {
    if (node == null)
      node = document.documentElement;
    if (observedNodes.indexOf(node) === -1) {
      observedNodes.push(node);
      if (isShadowRoot(node)) {
        console.log('shadowRoot discovered', node.host, node);
        notifyShadowRootListeners();
      }
      shadowRootObserver(node, shadowRoot => monitorShadowRoots(shadowRoot));
    }
    debugLog('monitorShadowRoots', node);
    var producer = shadowRootProducer(node);
    var shadowRoot;
    while (shadowRoot = producer()) {
      if (shadowRoot != node)
        monitorShadowRoots(shadowRoot);
    }
  }

  let listenerContexts = []

  let notifyShadowRootListeners = () => {
    for (var observedNode of observedNodes) {
      if (!isShadowRoot(observedNode)) continue;
      for (var listenerContext of listenerContexts) {
        if (listenerContext.nodes.indexOf(observedNode) !== -1) continue;
        else {
          listenerContext.nodes.push(observedNode);
          listenerContext.listener(observedNode);
        }
      }
    }
  };

  window.addShadowRootListener = (listener) => {
    if (!listenerContexts.find(v => v.listener == listener)) listenerContexts.push({
      listener: listener,
      nodes: []
    })
    notifyShadowRootListeners();
  }
  monitorShadowRoots();
})();
