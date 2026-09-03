"use client";

import { useEffect, useRef } from "react";

let seq = 0;

/**
 * Makes the browser/gesture back button close an open overlay or modal
 * instead of leaving the page. Pushes a history entry while `open`, and
 * calls `onDismiss` when that entry is popped — whether by a real back
 * navigation or by the layer closing itself through the UI (in which case
 * we consume the entry ourselves so a later back press isn't a no-op).
 *
 * Layers stack correctly: comparing the popped-to state's id against this
 * hook's own id (rather than just "a popstate happened") means a modal
 * opened on top of an overlay closes on the first back press without also
 * closing the overlay underneath it.
 */
export function useBackDismiss(open: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;
    const id = ++seq;
    let poppedByUser = false;
    history.pushState({ dismissId: id }, "");

    function onPopState(e: PopStateEvent) {
      const state = e.state as { dismissId?: number } | null;
      if (state?.dismissId !== id) {
        poppedByUser = true;
        onDismissRef.current();
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (!poppedByUser) history.back();
    };
  }, [open]);
}
