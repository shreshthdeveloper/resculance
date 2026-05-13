/**
 * Camera Service
 * Handles camera feed authentication and streaming with direct API calls
 */

import api from './api';

class CameraService {
  constructor() {
    this.sessions = new Map(); // Store stream URLs per device
  }

  /**
   * Get camera stream URL by authenticating directly with 808GPS API
   * @param {Object} device - Device object
   * @param {string} device.id - Database device ID
   * @returns {Promise<string>} - Authenticated camera stream URL
   */
  async getCameraStreamUrl(device) {
    const { id } = device;

    if (!id) {
      throw new Error('Device database ID is required');
    }

    try {
      console.log('[CameraService] Fetching device credentials for device:', id);
      
      // Get device credentials from backend
      const response = await api.get(`/ambulances/devices/${id}/stream`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get device credentials');
      }

      const { deviceId, username, password, apiBase, loginUrl } = response.data.data;
      
      console.log('[CameraService] Got credentials, authenticating with 808GPS...');
      console.log('[CameraService] Login URL:', loginUrl);

      // Authenticate directly with 808GPS API using fetch (to avoid CORS issues with axios)
      const loginParams = new URLSearchParams({
        account: username,
        password: password
      });

      const loginResponse = await fetch(`${loginUrl}?${loginParams.toString()}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });

      if (!loginResponse.ok) {
        throw new Error(`Failed to authenticate with camera API: ${loginResponse.status} ${loginResponse.statusText}`);
      }

      const loginData = await loginResponse.json();
      console.log('[CameraService] Login response:', loginData);

      // Check for login failure
      if (loginData.result !== 0) {
        const errorMsg = loginData.message || 'Authentication failed';
        throw new Error(`Camera authentication failed: ${errorMsg}`);
      }

      const jsession = loginData.jsession || loginData.JSESSIONID;

      if (!jsession) {
        throw new Error('Failed to obtain camera session (no jsession in response)');
      }

      console.log('[CameraService] Authentication successful, jsession:', jsession);

      // Build camera stream URL - this is the actual player URL
      const streamUrl = `${apiBase}/open/player/video.html?lang=en&devIdno=${encodeURIComponent(deviceId)}&jsession=${encodeURIComponent(jsession)}`;
      
      console.log('[CameraService] Stream URL:', streamUrl);

      return streamUrl;
    } catch (error) {
      console.error('[CameraService] Failed to get camera stream URL:', error);
      throw error;
    }
  }

  /**
   * Clear session for a device
   * @param {string} deviceId
   */
  clearSession(deviceId) {
    this.sessions.delete(deviceId);
  }

  /**
   * Clear all sessions
   */
  clearAllSessions() {
    this.sessions.clear();
  }
}

// Export singleton instance
export default new CameraService();
