export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

function findViewTransitionElement(name: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>("[style]");
  for (const el of candidates) {
    if (el.style.getPropertyValue("view-transition-name") === name) return el;
  }
  return null;
}

// The destination page (product detail) fetches its data client-side, so it
// renders a loading state first and only mounts the element carrying
// `targetViewTransitionName` once that fetch resolves. We wait for that
// element to actually show up (bounded by timeoutMs) instead of guessing a
// fixed number of animation frames — guessing too short caused the browser
// to capture the "new" snapshot mid-loading-state (no matching element),
// which broke the shared-element morph: the old thumbnail would just fade
// out with nothing to morph into.
function waitForViewTransitionTarget(name: string, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (findViewTransitionElement(name)) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (findViewTransitionElement(name)) finish();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(finish, timeoutMs);
  });
}

// Wraps a Next.js client navigation in the View Transitions API so elements
// sharing a view-transition-name (see ProductCard / product detail page)
// morph instead of hard-cutting. Next's App Router (14.x) has no native
// View Transition integration, so "navigation finished" is approximated by
// waiting for `targetViewTransitionName` to appear in the DOM. Callers
// should only invoke this after already checking
// supportsViewTransitions()/prefersReducedMotion() themselves so the
// fallback path (a plain Link click) never gets intercepted needlessly.
export function navigateWithMorph(
  router: { push: (href: string) => void },
  href: string,
  targetViewTransitionName: string,
): void {
  if (!supportsViewTransitions()) {
    router.push(href);
    return;
  }
  try {
    const transition = document.startViewTransition(async () => {
      router.push(href);
      await waitForViewTransitionTarget(targetViewTransitionName);
    });
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
