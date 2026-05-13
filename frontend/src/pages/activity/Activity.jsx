import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, User, Activity as ActivityIcon, Filter, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import useWithGlobalLoader from '../../hooks/useWithGlobalLoader';
import { Table } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../hooks/useToast';

const Activity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter options
  const [activityTypes, setActivityTypes] = useState([]);
  const [users, setUsers] = useState([]);

  const { toast } = useToast();
  const runWithLoader = useWithGlobalLoader();

  useEffect(() => {
    fetchActivities();
    fetchFilterOptions();
  }, [pagination.page, selectedActivity, selectedUser, startDate, endDate, search]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      await runWithLoader(async () => {
      try {
        const params = {
          page: pagination.page,
          limit: pagination.limit
        };

        if (search) params.search = search;
        if (selectedActivity) params.activity = selectedActivity;
        if (selectedUser) params.userId = selectedUser;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const response = await api.get('/activities', { params });
        setActivities(response.data.activities || []);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }));
      } catch (error) {
        toast.error('Failed to fetch activities');
        console.error('Error fetching activities:', error);
      }
    }, 'Loading activities...');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [typesRes, usersRes] = await Promise.all([
        api.get('/activities/types'),
        api.get('/activities/users')
      ]);
      setActivityTypes(typesRes.data.activities || []);
      setUsers(usersRes.data.users || []);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const handleRefresh = () => {
    fetchActivities();
  toast.success('Activities refreshed');
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedActivity('');
    setSelectedUser('');
    setStartDate('');
    setEndDate('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatActivityType = (activity) => {
    return activity
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const columns = [
    {
      header: 'Activity',
      accessor: 'activity',
      cell: (value) => (
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-4 h-4 text-blue-500" />
          <span className="font-medium">{formatActivityType(value)}</span>
        </div>
      )
    },
    {
      header: 'Comments',
      accessor: 'comments',
      cell: (value) => (
        <span className="text-gray-700 text-sm">{value}</span>
      )
    },
    {
      header: 'User',
      accessor: 'user_name',
      cell: (value) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <span>{value}</span>
        </div>
      )
    },
    {
      header: 'Timestamp',
      accessor: 'created_at',
      cell: (value) => (
        <div className="text-sm text-gray-600">{formatDate(value)}</div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-600 mt-1">Monitor all system activities and changes</p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search comments, user, organization..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Activity Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity Type
              </label>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Activities</option>
                {activityTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatActivityType(type)}
                  </option>
                ))}
              </select>
            </div>

            {/* User */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end lg:col-span-1">
              <Button
                onClick={handleClearFilters}
                variant="outline"
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Activities Table */}
      <Card>
        <Table
          data={activities}
          columns={columns}
          loading={loading}
          emptyMessage="No activities found"
        />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 border-t">
            <div className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total activities)
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Activity;
