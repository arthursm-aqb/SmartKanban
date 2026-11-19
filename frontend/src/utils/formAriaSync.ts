import { useEffect, useRef } from 'react';

/**
 * Synchronizes native `:user-invalid` visual feedback with ARIA `aria-invalid`,
 * dynamic `aria-describedby` error linking (`data-error="err-id"`),
 * and a single polite page-level live region announcement on blur/change.
 */
export function useAccessibleFormValidation<T extends HTMLFormElement>() {
  const formRef = useRef<T>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const supportsUserInvalid =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('selector(:user-invalid)');

    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.className = 'visually-hidden';
    document.body.append(announcer);

    let announceTimer: ReturnType<typeof setTimeout> | undefined;
    let announcedField: HTMLElement | null = null;
    const dirtyState = new WeakMap<HTMLElement, { interacted: boolean; blurred: boolean }>();
    const flagged = new WeakSet<HTMLElement>();
    const announced = new WeakSet<HTMLElement>();

    const linkError = (el: HTMLElement, shown: boolean) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length > 0) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    };

    const announceError = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const errorEl = document.getElementById(errorId);
      if (!errorEl) return;
      const labelText = el.labels?.[0]?.textContent?.trim();
      const prefix = labelText ? `${labelText}: ` : '';
      const msg = errorEl.textContent?.trim() ?? '';
      clearTimeout(announceTimer);
      announcer.textContent = '';
      announcedField = el;
      announceTimer = setTimeout(() => {
        announcer.textContent = prefix + msg;
      }, 450);
    };

    const isFieldInvalid = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean => {
      if (supportsUserInvalid) {
        try {
          return el.matches(':user-invalid');
        } catch {
          // Fallback below
        }
      }
      const st = dirtyState.get(el);
      return Boolean(st && st.interacted && st.blurred && !el.validity.valid);
    };

    const syncAria = (el: EventTarget | null, shouldAnnounce = false) => {
      if (
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        )
      ) {
        return;
      }

      const invalid = isFieldInvalid(el);
      if (!supportsUserInvalid) {
        const st = dirtyState.get(el);
        if (st && st.interacted && st.blurred) {
          el.classList.toggle('user-invalid-fallback', invalid);
          el.classList.toggle('user-valid-fallback', !invalid);
        }
      }

      if (invalid) {
        if (shouldAnnounce && !announced.has(el)) {
          announceError(el);
          announced.add(el);
        }
        el.setAttribute('aria-invalid', 'true');
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
        el.setAttribute('aria-invalid', 'false');
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el) {
          clearTimeout(announceTimer);
          announcer.textContent = '';
        }
      }
    };

    form.querySelectorAll('input, textarea, select').forEach((el) => {
      if (!el.hasAttribute('aria-invalid')) {
        el.setAttribute('aria-invalid', 'false');
      }
    });

    const onBlur = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        const st = dirtyState.get(target) ?? { interacted: false, blurred: false };
        st.blurred = true;
        dirtyState.set(target, st);
        syncAria(target, true);
      }
    };

    const onInput = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        const st = dirtyState.get(target) ?? { interacted: false, blurred: false };
        st.interacted = true;
        dirtyState.set(target, st);
        if (target.hasAttribute('aria-invalid')) syncAria(target, false);
      }
    };

    const onInvalid = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        dirtyState.set(target, { interacted: true, blurred: true });
        announced.add(target);
        syncAria(target, false);
      }
    };

    form.addEventListener('blur', onBlur, true);
    form.addEventListener('input', onInput);
    form.addEventListener('change', onBlur, true);
    form.addEventListener('invalid', onInvalid, true);

    return () => {
      clearTimeout(announceTimer);
      form.removeEventListener('blur', onBlur, true);
      form.removeEventListener('input', onInput);
      form.removeEventListener('change', onBlur, true);
      form.removeEventListener('invalid', onInvalid, true);
      announcer.remove();
    };
  }, []);

  return formRef;
}
