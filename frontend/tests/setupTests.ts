import '@testing-library/jest-dom/vitest';

// JSDOM lacks native <dialog> showModal/close methods; provide minimal spec-compliant stub for tests.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(returnValue?: string) {
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
