import { useEffect, type RefObject } from 'react';

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    const first = node.querySelector<HTMLElement>(focusable);
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(focusable)].filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const start = items[0]; const end = items[items.length - 1];
      if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end.focus(); }
      else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start.focus(); }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => { node.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [onClose, open, ref]);
}
