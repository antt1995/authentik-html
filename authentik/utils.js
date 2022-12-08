const debugLogEnabled = false;

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

function debugLog() {
  if (!debugLogEnabled)
    return;
  arguments = Array.from(arguments);
  if (arguments[1] != null && isShadowRoot(arguments[1]))
    arguments.splice(1, 0, arguments[1].host);
  console.debug.apply(this, arguments);
}

const isElementNode = (node) => node && node.nodeType === Node.ELEMENT_NODE
const isShadowRoot = (node) => node &&
  node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
  node.host != null &&
  node.host.shadowRoot === node &&
  !Object.keys(node)
  .find(v => v.includes('shady'))
const shadowRootProducer = (node) => {
  if (!isElementNode(node) && !isShadowRoot(node)) return () => {};
  var ni = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT, v => isShadowRoot(v.shadowRoot));
  return () => {
    var next = ni.nextNode();
    if (next == null) return;
    debugLog('produced', next);
    return next.shadowRoot;
  };
}
const shadowRootObserver = (node, callback) => {
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

const observing = []
window.observeShadowRoots = (node, callback) => {
  if (!isShadowRoot(node)) {
    if (node == document)
      node = document.documentElement;
    assert(node == document.documentElement, 'invalid node', node);
  }
  assert(callback, 'callback required');
  if (observing.indexOf(node) == -1) {
    observing.push(node);
    if (isShadowRoot(node)) {
      console.log('shadowRoot discovered', node.host, node)
      callback(node);
    }
    shadowRootObserver(node, v => observeShadowRoots(v, callback));
  }
  debugLog('observeShadowRoots', node);
  var producer = shadowRootProducer(node);
  var shadowRoot;
  while (shadowRoot = producer()) {
    if (shadowRoot == node)
      continue;
    observeShadowRoots(shadowRoot, callback);
  }
}


window.addEventListener("load", () => {
  console.log('load');
  //  observeShadowRoots(document.documentElement);
});
document.addEventListener("DOMContentLoaded", () => {
  console.log('DOMContentLoaded');
  observeShadowRoots(document, dom => {
    var style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = 'input { background-color: red !important; }';
    (dom.head || dom)
    .appendChild(style);
  });




});
console.log('start')
//observeShadowRoots(document.documentElement);
