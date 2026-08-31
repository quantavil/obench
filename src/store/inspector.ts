export const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

let lastTriggerElement: HTMLElement | null = null;

export function shouldLockInspectorScroll(width: number): boolean {
  return width < 1024;
}

export function focusableElements(dialog: HTMLElement): HTMLElement[] {
  if (!dialog || typeof dialog.querySelectorAll !== 'function') return [];
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1,
  );
}

export function recordInspectorTrigger(trigger?: HTMLElement | null): void {
  if (trigger && typeof trigger.focus === 'function') {
    lastTriggerElement = trigger;
  } else if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    lastTriggerElement = document.activeElement;
  }
}

export function restoreInspectorFocus(): void {
  if (lastTriggerElement && typeof lastTriggerElement.focus === 'function') {
    try {
      lastTriggerElement.focus();
    } catch {
      // Ignore focus errors
    }
  }
  lastTriggerElement = null;
}

export function reconcileInspectorScrollLock(isOpen: boolean, width?: number): void {
  if (typeof document === 'undefined') return;
  const currentWidth = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  if (isOpen && shouldLockInspectorScroll(currentWidth)) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

export function trapFocus(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab' || !container) return;
  const focusables = focusableElements(container);
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }
}
