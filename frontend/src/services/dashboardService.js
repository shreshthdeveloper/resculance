import apiClient from './api';

class DashboardService {
  async getStats() {
    // return full axios response so callers can inspect status and data consistently
    const response = await apiClient.get('/dashboard/stats');
    return response;
  }
}

export default new DashboardService();
