// Custom confirm / alert dialogs — a themed replacement for the native
// `Alert.alert`. A single <ConfirmHost/> (mounted at the root) renders the
// modal; `confirm()` / `notify()` are imperative so they can be called from
// anywhere (event handlers, async flows) without wiring per-screen state.
//
//   const ok = await confirm({ title, message, confirmLabel, destructive });
//   if (ok) doTheThing();
//
//   await notify({ title, message });   // single-button notice

import { create } from 'zustand';

export const useConfirmStore = create((set) => ({
  dialog: null, // { mode, title, message, confirmLabel, cancelLabel, destructive, icon, resolve }
  open(dialog) {
    set({ dialog });
  },
  close() {
    set({ dialog: null });
  },
}));

// Two-button confirmation. Resolves true (confirm) / false (cancel/dismiss).
export function confirm(opts = {}) {
  return new Promise((resolve) => {
    useConfirmStore.getState().open({
      mode: 'confirm',
      title: opts.title ?? 'Are you sure?',
      message: opts.message ?? '',
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      destructive: !!opts.destructive,
      icon: opts.icon ?? null,
      resolve,
    });
  });
}

// Single-button notice (replaces info/error `Alert.alert`). Resolves when
// dismissed.
export function notify(opts = {}) {
  return new Promise((resolve) => {
    useConfirmStore.getState().open({
      mode: 'alert',
      title: opts.title ?? '',
      message: opts.message ?? '',
      confirmLabel: opts.confirmLabel ?? 'OK',
      destructive: !!opts.destructive,
      icon: opts.icon ?? null,
      resolve,
    });
  });
}
