// Harden Node.prototype against cross-parent removeChild / insertBefore calls.
//
// React's commit phase calls parent.removeChild(child) and parent.insertBefore(node, ref)
// based on the virtual DOM it last rendered. If a third party (browser extension like
// Google Translate / Grammarly, hello-pangea/dnd portal, Google Maps overlay, Turbopack
// HMR) has moved or replaced the node in the meantime, the native call throws
// NotFoundError: "The node to be removed is not a child of this node" and crashes the
// whole tree.
//
// The patch turns those specific inconsistencies into no-ops. It does not change
// behavior for the normal path (child.parentNode === this). See:
// https://github.com/facebook/react/issues/11538

declare global {
  interface Node {
    __cv_dom_patched__?: boolean;
  }
}

export function patchDomForThirdPartyMutations() {
  if (typeof window === 'undefined') return;
  const proto = Node.prototype as Node & {
    __cv_dom_patched__?: boolean;
  };
  if (proto.__cv_dom_patched__) return;
  proto.__cv_dom_patched__ = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn(
          '[patch-dom] Suppressed removeChild: target is not a child of this node. ' +
            'Likely caused by a browser extension or third-party DOM mutation.',
          { child, parent: this }
        );
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn(
          '[patch-dom] Suppressed insertBefore with stale reference; falling back to appendChild.',
          { newNode, referenceNode, parent: this }
        );
      }
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
