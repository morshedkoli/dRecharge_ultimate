import { useEffect, useRef } from "react";

/**
 * useModalEffect — call inside any custom modal component.
 * When `open` is true:
 *  - Locks background body scroll (overflow: hidden on <body>)
 *  - Auto-focuses the first focusable input / textarea / select inside the modal
 *
 * Usage: call at top of modal component, pass a ref to the modal container div.
 *   const containerRef = useModalEffect(open);
 *   <div ref={containerRef}>...</div>
 */
export function useModalEffect(open: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-focus first input / textarea / select
    const frame = requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(
        "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled])"
      );
      el?.focus();
    });

    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(frame);
    };
  }, [open]);

  return containerRef;
}
