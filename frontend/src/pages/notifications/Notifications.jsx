import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import notificationService from '../../services/notificationService';
import { useToast } from '../../hooks/useToast';
import socketService from '../../services/socketService';

export const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const { user } = useAuthStore();
  const { toast } = useToast();

  const fetch = async (replace = false) => {
    setLoading(true);
    try {
      const resp = await notificationService.getNotifications(limit, 0);
      // service returns response.data, which is { notifications }
      const items = resp.notifications || [];
      setNotifications(items);
      setHasMore(items.length === limit);
      setOffset(items.length);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();

    // listen for real-time notifications and prepend them
    const handler = (n) => {
      setNotifications(prev => [n, ...prev]);
      toast.info(n.title || 'New notification', 3000);
    };

    socketService.onNotification(handler);
    return () => socketService.offNotification(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Mark read failed', err);
      toast.error('Failed to mark notification');
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked read');
    } catch (err) {
      console.error('Mark all read failed', err);
      toast.error('Failed to mark all');
    }
  };

  const del = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (err) {
      console.error('Delete failed', err);
      toast.error('Failed to delete notification');
    }
  };

  const loadMore = async () => {
    try {
      const resp = await notificationService.getNotifications(limit, offset);
      const items = resp.notifications || [];
      // append new items
      setNotifications(prev => [...prev, ...items]);
      setHasMore(items.length === limit);
      setOffset(prev => prev + items.length);
    } catch (err) {
      console.error('Load more failed', err);
      toast.error('Failed to load more');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mt-5 mb-2">Notifications</h1>
        <p className="text-secondary">All your notifications — recent first. Manage and act on notifications here.</p>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-semibold">Recent Notifications</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={markAllRead}>Mark all read</Button>
            <Button variant="danger" onClick={async () => {
              // delete all - reuse service (deleteAllNotifications)
              try {
                await notificationService.deleteAllNotifications();
                setNotifications([]);
                toast.success('All notifications deleted');
              } catch (err) {
                console.error('Delete all failed', err);
                toast.error('Failed to delete all');
              }
            }}>
              <Trash2 className="w-4 h-4 mr-2" /> Clear
            </Button>
          </div>
        </div>

        <div className="divide-y">
          {notifications.length === 0 && (
            <div className="py-12 text-center text-secondary">
              <p className="text-lg">No notifications yet</p>
              <p className="text-sm">You'll see important updates here.</p>
            </div>
          )}

          {notifications.map(n => (
            <motion.div key={n.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`relative p-4 flex items-start gap-4 ${n.is_read ? 'bg-transparent' : 'bg-primary/5'}`}>
              <div className="w-10 h-10 bg-background-card rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-text">{n.title}</div>
                    <div className="text-sm text-text-secondary mt-1">{n.message}</div>
                  </div>
                  <div className="text-right text-xs text-text-secondary pr-12">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {!n.is_read && (
                    <Button size="sm" onClick={() => markAsRead(n.id)}>
                      <Check className="w-4 h-4 mr-2" /> Mark read
                    </Button>
                  )}
                </div>

                {/* small delete icon at the right end */}
                <button
                  onClick={() => del(n.id)}
                  aria-label="Delete notification"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-error/10 text-error hover:bg-error hover:text-white p-2 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {hasMore && (
          <div className="pt-4 text-center">
            <Button onClick={loadMore} loading={loading}>Load more</Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Notifications;
