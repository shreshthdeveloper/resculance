import useUiStore from '../store/uiStore';

/**
 * Helper to run async functions with the global loader visible.
 * Usage:
 * const run = useWithGlobalLoader();
 * await run(async () => { await doSomething(); }, 'Optional message');
 */
export default function useWithGlobalLoader() {
  const { showLoader, hideLoader } = useUiStore();

  return async (fn, message = 'Please wait...') => {
    try {
      showLoader(message);
      const result = await fn();
      hideLoader();
      return result;
    } catch (err) {
      hideLoader();
      throw err;
    }
  };
}
