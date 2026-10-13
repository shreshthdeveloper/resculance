// App-wide settings. Currently just the public session-sharing config, which
// is global and superadmin-managed (mirrors backend settingsRoutes.js and the
// web `settingsService`).

import { api } from './client';

// GET /settings/public-share — returns { enabled, requirePin, hasPin }.
// 403 for non-superadmins (the routes are authorize('superadmin')).
export async function getPublicShareConfig() {
  const res = await api.get('/settings/public-share');
  const data = res.data.data ?? {};
  return {
    enabled: !!data.enabled,
    // Backend defaults requirePin to true when never set; treat anything but
    // an explicit `false` as "required".
    requirePin: data.requirePin !== false,
    hasPin: !!data.hasPin,
  };
}

// PUT /settings/public-share — body: { enabled?, requirePin?, pin? }.
// A non-empty `pin` (4–32 chars) replaces the stored PIN.
export async function updatePublicShareConfig(changes = {}) {
  const payload = {};
  if (typeof changes.enabled === 'boolean') payload.enabled = changes.enabled;
  if (typeof changes.requirePin === 'boolean') payload.requirePin = changes.requirePin;
  if (changes.pin) payload.pin = changes.pin;
  const res = await api.put('/settings/public-share', payload);
  const data = res.data.data ?? {};
  return {
    enabled: !!data.enabled,
    requirePin: data.requirePin !== false,
    hasPin: !!data.hasPin,
  };
}
