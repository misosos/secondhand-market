export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

// Wraps a Next.js client navigation in the View Transitions API so elements
// sharing a view-transition-name (see ProductCard / product detail page)
// morph instead of hard-cutting. Next's App Router (14.x) has no native
// View Transition integration, so "navigation finished" is approximated
// with a couple of animation frames after router.push — not frame-perfect,
// but close enough in practice for the shared-element morph to read
// correctly. Callers should only invoke this after already checking
// supportsViewTransitions()/prefersReducedMotion() themselves so the
// fallback path (a plain Link click) never gets intercepted needlessly.
export function navigateWithMorph(router: { push: (href: string) => void }, href: string): void {
  if (!supportsViewTransitions()) {
    router.push(href);
    return;
  }
  try {
    const transition = document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          router.push(href);
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    // router.push already ran above by the time any of these settle, so a
    // rejection here (e.g. the browser times out the transition because the
    // tab was backgrounded) only means the morph animation was skipped, not
    // that navigation failed — safe to swallow instead of leaving it as an
    // unhandled rejection.
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    transition.finished.catch(() => {});
  } catch {
    router.push(href);
  }
}
