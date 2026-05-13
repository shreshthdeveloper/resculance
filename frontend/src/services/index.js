import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response;
  },

  uploadProfileImage: async (formData) => {
    const response = await api.post('/auth/profile/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response;
  },

  updateProfile: async (userData) => {
    const response = await api.put('/auth/profile', userData);
    return response;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response;
  },

  refreshToken: async (refreshToken) => {
    const response = await api.post('/auth/refresh-token', { refreshToken });
    return response;
  },
};

export const organizationService = {
  getAll: async (params) => {
    const response = await api.get('/organizations', { params });
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`/organizations/${id}`);
    return response;
  },

  create: async (data) => {
    const response = await api.post('/organizations', data);
    return response;
  },

  update: async (id, data) => {
    const response = await api.put(`/organizations/${id}`, data);
    return response;
  },

  delete: async (id) => {
    const response = await api.delete(`/organizations/${id}`);
    return response;
  },

  suspend: async (id) => {
    const response = await api.patch(`/organizations/${id}/suspend`);
    return response;
  },

  activate: async (id) => {
    const response = await api.patch(`/organizations/${id}/activate`);
    return response;
  },

  deactivate: async (id) => {
    const response = await api.patch(`/organizations/${id}/deactivate`);
    return response;
  },
};

export const userService = {
  getAll: async (params) => {
    const response = await api.get('/users', { params });
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response;
  },

  create: async (data) => {
    const response = await api.post('/users', data);
    return response;
  },

  update: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response;
  },

  approve: async (id) => {
    const response = await api.patch(`/users/${id}/approve`);
    return response;
  },

  suspend: async (id) => {
    const response = await api.patch(`/users/${id}/suspend`);
    return response;
  },

  activate: async (id) => {
    const response = await api.patch(`/users/${id}/activate`);
    return response;
  },

  delete: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response;
  },
  uploadProfileImage: async (id, formData) => {
    const response = await api.post(`/users/${id}/profile-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response;
  },
};

export const ambulanceService = {
  getAll: async (params) => {
    const response = await api.get('/ambulances', { params });
    return response;
  },

  getMyAmbulances: async () => {
    const response = await api.get('/ambulances/my-ambulances');
    return response;
  },

  getForUser: async (userId) => {
    const response = await api.get(`/ambulances/for-user/${userId}`);
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`/ambulances/${id}`);
    return response;
  },

  create: async (data) => {
    const response = await api.post('/ambulances', data);
    return response;
  },

  update: async (id, data) => {
    const response = await api.put(`/ambulances/${id}`, data);
    return response;
  },

  approve: async (id) => {
    const response = await api.patch(`/ambulances/${id}/approve`);
    return response;
  },

  assign: async (id, userId, role, assigningOrganizationId) => {
    const body = { userId, role };
    if (assigningOrganizationId) body.assigningOrganizationId = assigningOrganizationId;
    const response = await api.post(`/ambulances/${id}/assign`, body);
    return response;
  },

  unassign: async (id, userId) => {
    const response = await api.delete(`/ambulances/${id}/unassign/${userId}`);
    return response;
  },

  getAssignedUsers: async (id) => {
    const response = await api.get(`/ambulances/${id}/assigned-users`);
    return response;
  },

  updateLocation: async (id, latitude, longitude) => {
    const response = await api.post(`/ambulances/${id}/location`, { latitude, longitude });
    return response;
  },

  delete: async (id) => {
    const response = await api.delete(`/ambulances/${id}`);
    return response;
  },

  deactivate: async (id) => {
    const response = await api.patch(`/ambulances/${id}/deactivate`);
    return response;
  },

  activate: async (id) => {
    const response = await api.patch(`/ambulances/${id}/activate`);
    return response;
  },

  // Device management
  getDevices: async (ambulanceId) => {
    const response = await api.get(`/ambulances/${ambulanceId}/devices`);
    return response;
  },

  getDeviceById: async (deviceId) => {
    const response = await api.get(`/ambulances/devices/${deviceId}`);
    return response;
  },

  createDevice: async (ambulanceId, data) => {
    const response = await api.post(`/ambulances/${ambulanceId}/devices`, data);
    return response;
  },

  updateDevice: async (deviceId, data) => {
    const response = await api.put(`/ambulances/devices/${deviceId}`, data);
    return response;
  },

  deleteDevice: async (deviceId) => {
    const response = await api.delete(`/ambulances/devices/${deviceId}`);
    return response;
  },

  // Get device location (proxied through backend)
  getDeviceLocation: async (deviceId) => {
    const response = await api.get(`/ambulances/devices/${deviceId}/location`);
    return response;
  },

  // Get camera stream URL (proxied through backend)
  getDeviceStream: async (deviceId) => {
    const response = await api.get(`/ambulances/devices/${deviceId}/stream`);
    return response;
  },

  // Get any device data based on type (proxied through backend)
  getDeviceData: async (deviceId) => {
    const response = await api.get(`/ambulances/devices/${deviceId}/data`);
    return response;
  },

  // Get all device locations for an ambulance (proxied through backend)
  getAmbulanceDevicesLocation: async (ambulanceId) => {
    const response = await api.get(`/ambulances/${ambulanceId}/devices/location`);
    return response;
  },

  authenticateDevice: async (deviceId) => {
    const response = await api.post(`/ambulances/devices/${deviceId}/authenticate`);
    return response;
  },
};

export const patientService = {
  getAll: async (params) => {
    const response = await api.get('/patients', { params });
    return response;
  },

  // **BLAZING FAST**: Denormalized query - only returns available patients
  getAvailable: async (params) => {
    const response = await api.get('/patients/available', { params });
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`/patients/${id}`);
    return response;
  },

  getByCode: async (code) => {
    const response = await api.get(`/patients/code/${code}`);
    return response;
  },

  create: async (data) => {
    const response = await api.post('/patients', data);
    return response;
  },

  update: async (id, data) => {
    const response = await api.put(`/patients/${id}`, data);
    return response;
  },

  onboard: async (id, data) => {
    const response = await api.post(`/patients/${id}/onboard`, data);
    return response;
  },

  offboard: async (sessionId, data) => {
    const response = await api.patch(`/patients/sessions/${sessionId}/offboard`, data);
    return response;
  },

  hideData: async (id) => {
    const response = await api.patch(`/patients/${id}/hide-data`);
    return response;
  },

  unhideData: async (id) => {
    const response = await api.patch(`/patients/${id}/unhide-data`);
    return response;
  },

  addVitalSigns: async (id, data) => {
    const response = await api.post(`/patients/${id}/vital-signs`, data);
    return response;
  },

  getVitalSigns: async (id, params) => {
    const response = await api.get(`/patients/${id}/vital-signs`, { params });
    return response;
  },

  getAllSessions: async (params) => {
    const response = await api.get('/patients/sessions', { params });
    return response;
  },

  getSession: async (sessionId) => {
    const response = await api.get(`/patients/sessions/${sessionId}`);
    return response;
  },

  getSessionById: async (sessionId) => {
    const response = await api.get(`/patients/sessions/${sessionId}`);
    return response;
  },

  getSessions: async (id) => {
    const response = await api.get(`/patients/${id}/sessions`);
    return response;
  },

  addCommunication: async (id, data) => {
    const response = await api.post(`/patients/${id}/communications`, data);
    return response;
  },

  // Session-based group chat methods
  getSessionMessages: async (sessionId, params) => {
    const response = await api.get(`/patients/sessions/${sessionId}/messages`, { params });
    return response;
  },

  sendSessionMessage: async (sessionId, data) => {
    const response = await api.post(`/patients/sessions/${sessionId}/messages`, data);
    return response;
  },

  markMessageAsRead: async (messageId) => {
    const response = await api.patch(`/patients/messages/${messageId}/read`);
    return response;
  },

  getUnreadCount: async (sessionId) => {
    const response = await api.get(`/patients/sessions/${sessionId}/unread-count`);
    return response;
  },

  delete: async (id) => {
    const response = await api.delete(`/patients/${id}`);
    return response;
  },

  activate: async (id) => {
    const response = await api.patch(`/patients/${id}/activate`);
    return response;
  },
};

export const sessionService = {
  getAll: async (params) => {
    const response = await api.get('/sessions', { params });
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`/sessions/${id}`);
    return response;
  },

  getStats: async (params = {}) => {
    const response = await api.get('/sessions/stats', { params });
    return response;
  },

  // Session data (notes, medications, files)
  getData: async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}/data`);
    return response;
  },

  getDataByType: async (sessionId, type) => {
    const response = await api.get(`/sessions/${sessionId}/data/${type}`);
    return response;
  },

  addNote: async (sessionId, note) => {
    const response = await api.post(`/sessions/${sessionId}/data`, {
      dataType: 'note',
      content: {
        text: note.text
      }
    });
    return response;
  },

  addMedication: async (sessionId, medication) => {
    const response = await api.post(`/sessions/${sessionId}/data`, {
      dataType: 'medication',
      content: {
        name: medication.name,
        dosage: medication.dosage,
        route: medication.route
      }
    });
    return response;
  },

  uploadFile: async (sessionId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/sessions/${sessionId}/data/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response;
  },

  deleteData: async (sessionId, dataId) => {
    const response = await api.delete(`/sessions/${sessionId}/data/${dataId}`);
    return response;
  },

  downloadFile: async (sessionId, dataId) => {
    const response = await api.get(`/sessions/${sessionId}/data/files/${dataId}/download`, {
      responseType: 'blob'
    });
    return response;
  }
};

export const collaborationService = {
  getAll: async (params) => {
    const response = await api.get('/collaborations', { params });
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`/collaborations/${id}`);
    return response;
  },

  create: async (data) => {
    const response = await api.post('/collaborations', data);
    return response;
  },

  accept: async (id, data) => {
    const response = await api.patch(`/collaborations/${id}/accept`, data);
    return response;
  },

  reject: async (id, data) => {
    const response = await api.patch(`/collaborations/${id}/reject`, data);
    return response;
  },

  cancel: async (id) => {
    const response = await api.patch(`/collaborations/${id}/cancel`);
    return response;
  },

  delete: async (id) => {
    const response = await api.delete(`/collaborations/${id}`);
    return response;
  },
};

export const dashboardService = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response;
  },
};

export const activityService = {
  getAll: async (params = {}) => {
    const response = await api.get('/activities', { params });
    return response;
  }
};
