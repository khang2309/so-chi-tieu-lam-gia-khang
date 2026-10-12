/**
 * Global Toast Dispatcher
 */
export function showToast(message: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('show-app-toast', { detail: message }));
  }
}
