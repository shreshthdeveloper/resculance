import { create } from 'zustand';

export const useUiStore = create((set) => ({
  globalLoading: false,
  loadingMessage: '',
  showLoader: (message = '') => set({ globalLoading: true, loadingMessage: message }),
  hideLoader: () => set({ globalLoading: false, loadingMessage: '' }),
}));

export default useUiStore;
