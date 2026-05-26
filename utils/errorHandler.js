// utils/errorHandler.js
// Centralized error handling for the app
export function handleError(err, context = '') {
  console.error(`[Error] ${context}`, err);
  const msg = err?.message || String(err);
  // show toast if available (imported lazily to avoid circular deps)
  try {
    // Dynamically import showToast to avoid import cycle
    import('./utils.js').then(mod => {
      if (typeof mod.showToast === 'function') {
        mod.showToast(`❌ ${msg}`, 'error');
      }
    });
  } catch (e) {
    // fallback console
    console.warn('Toast unavailable', e);
  }
  return { handled: true, message: msg };
}
