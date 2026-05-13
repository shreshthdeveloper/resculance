import { useState, useEffect, useRef } from 'react';
import { Send, X, Loader, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../services/chatService';
import socketService from '../services/socketService';
import { useAuthStore } from '../store/authStore';
import { formatRoleName } from '../utils/roleUtils';

const ChatPanel = ({ sessionId, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { user } = useAuthStore();

  // Fetch initial messages
  useEffect(() => {
    if (isOpen && sessionId) {
      loadMessages();
      joinSessionRoom();
    }

    return () => {
      if (sessionId) {
        socketService.leaveSession(sessionId);
      }
    };
  }, [isOpen, sessionId]);

  // Set up real-time message listeners
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    const handleNewMessage = (data) => {
      if (data.sessionId === sessionId || data.session_id === sessionId) {
        setMessages(prev => [...prev, {
          id: data.id,
          message: data.message,
          sender_first_name: data.senderFirstName || data.sender_first_name,
          sender_last_name: data.senderLastName || data.sender_last_name,
          sender_role: data.senderRole || data.sender_role,
          sender_id: data.senderId || data.sender_id,
          message_type: data.messageType || data.message_type || 'text',
          created_at: data.timestamp || data.created_at || new Date().toISOString()
        }]);
      }
    };

    const handleUserTyping = (data) => {
      if (data.sessionId === sessionId && data.userId !== user?.id) {
        if (data.isTyping) {
          setTypingUsers(prev => {
            if (!prev.find(u => u.userId === data.userId)) {
              return [...prev, { userId: data.userId, userName: data.userName }];
            }
            return prev;
          });
        } else {
          setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        }
      }
    };

    const handleUserJoined = (data) => {
      if (data.sessionId === sessionId) {
        fetchOnlineUsers();
      }
    };

    const handleUserLeft = (data) => {
      if (data.sessionId === sessionId) {
        fetchOnlineUsers();
      }
    };

    socketService.onMessage(handleNewMessage);
    socketService.onUserTyping(handleUserTyping);
    socketService.onUserJoined(handleUserJoined);
    socketService.onUserLeft(handleUserLeft);

    return () => {
      socketService.offMessage(handleNewMessage);
      socketService.offUserTyping(handleUserTyping);
    };
  }, [isOpen, sessionId, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await chatService.getMessages(sessionId);
      setMessages(response.data?.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSessionRoom = () => {
    socketService.joinSession(sessionId);
    fetchOnlineUsers();
  };

  const fetchOnlineUsers = () => {
    socketService.getOnlineUsers(sessionId, (data) => {
      setOnlineUsers(data.users || []);
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Send via API (which will trigger socket event to all users)
      await chatService.sendMessage(sessionId, messageText);
      
      // Stop typing indicator
      socketService.stopTyping(sessionId);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing indicator
    if (e.target.value.trim()) {
      socketService.startTyping(sessionId);

      // Stop typing after 2 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(sessionId);
      }, 2000);
    } else {
      socketService.stopTyping(sessionId);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getRoleColor = (role) => {
    const roleLower = role?.toLowerCase() || '';
    if (roleLower.includes('doctor')) return 'text-primary';
    if (roleLower.includes('paramedic')) return 'text-success';
    if (roleLower.includes('nurse')) return 'text-info';
    if (roleLower.includes('driver')) return 'text-warning';
    return 'text-text-secondary';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-background-card shadow-2xl z-[9990] flex flex-col border-l border-border"
      >
        {/* Header */}
        <div className="bg-primary text-white p-5 flex items-center justify-between border-b border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner relative">
              <Users className="w-6 h-6" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                {onlineUsers.length}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">Team Chat</h3>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse shadow-lg shadow-success/50" />
                <span className="font-medium">{onlineUsers.length} member{onlineUsers.length !== 1 ? 's' : ''} online</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-110 text-white"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-text-secondary">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary">
              <div className="w-16 h-16 bg-background-card rounded-full flex items-center justify-center mb-3">
                <Users className="w-8 h-8 opacity-30" />
              </div>
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation with your team</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isOwnMessage = msg.sender_id === user?.id;
                return (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                      {!isOwnMessage && (
                        <div className="flex items-center gap-2 px-3">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                            {msg.sender_first_name?.[0]}{msg.sender_last_name?.[0]}
                          </div>
                          <span className={`text-xs font-semibold ${getRoleColor(msg.sender_role)}`}>
                            {msg.sender_first_name} {msg.sender_last_name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-background text-text-secondary font-medium border border-border">
                            {formatRoleName(msg.sender_role)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-3 shadow-md transition-all hover:shadow-lg ${
                          isOwnMessage
                            ? 'bg-primary text-white rounded-br-md'
                            : 'bg-background-card text-text border border-border rounded-bl-md hover:border-primary/30'
                        }`}
                      >
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                        <span className={`text-[10px] mt-2 block font-medium ${isOwnMessage ? 'text-white/80' : 'text-text-secondary'}`}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              
              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-text-secondary px-2"
                >
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="italic">
                    {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 bg-background-card border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="Type your message..."
                className="w-full px-4 py-3.5 pr-14 bg-background border-2 border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-text placeholder:text-text-secondary shadow-sm hover:border-primary/50"
                disabled={sending}
                maxLength={500}
              />
              <div className={`absolute right-4 bottom-3.5 text-xs font-medium transition-colors ${
                newMessage.length > 450 ? 'text-error' : newMessage.length > 400 ? 'text-warning' : 'text-text-secondary'
              }`}>
                {newMessage.length}/500
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="p-3.5 bg-primary text-white rounded-2xl hover:shadow-xl disabled:bg-border disabled:cursor-not-allowed transition-all shadow-lg disabled:shadow-none disabled:from-border disabled:to-border"
              aria-label="Send message"
            >
              {sending ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
          </div>
          <p className="text-[11px] text-text-secondary mt-2.5 px-1 flex items-center gap-1.5">
            <span className="w-1 h-1 bg-text-secondary/50 rounded-full" />
            Press Enter to send • Shift+Enter for new line
          </p>
        </form>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChatPanel;
