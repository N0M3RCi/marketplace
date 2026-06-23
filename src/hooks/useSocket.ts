import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = '';

interface SocketMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  createdAt: string;
}

interface UseSocketOptions {
  userId?: string;
  username?: string;
  token?: string;
  conversationId?: string | null;
  onNewMessage?: (msg: SocketMessage) => void;
  onConversationRead?: (data: { conversationId: string; readBy: string }) => void;
  onTypingUpdate?: (data: { conversationId: string; userId: string; username?: string; isTyping: boolean }) => void;
}

export function useSocket(options: UseSocketOptions) {
  const {
    userId, username, token,
    conversationId,
    onNewMessage, onConversationRead, onTypingUpdate,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; timeout: NodeJS.Timeout }>>({});
  const onNewMessageRef = useRef(onNewMessage);
  const onConversationReadRef = useRef(onConversationRead);
  const onTypingUpdateRef = useRef(onTypingUpdate);

  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);
  useEffect(() => { onConversationReadRef.current = onConversationRead; }, [onConversationRead]);
  useEffect(() => { onTypingUpdateRef.current = onTypingUpdate; }, [onTypingUpdate]);

  useEffect(() => {
    if (!userId || !token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
      setConnected(false);
    });

    socket.on('message:new', (msg: SocketMessage) => {
      onNewMessageRef.current?.(msg);
    });

    socket.on('conversation:read-update', (data: { conversationId: string; readBy: string }) => {
      onConversationReadRef.current?.(data);
    });

    socket.on('typing:update', (data) => {
      if (data.userId === userId) return;
      onTypingUpdateRef.current?.(data);

      if (data.isTyping) {
        setTypingUsers(prev => {
          const existing = prev[data.conversationId + ':' + data.userId];
          if (existing) clearTimeout(existing.timeout);
          return {
            ...prev,
            [data.conversationId + ':' + data.userId]: {
              username: data.username || 'Someone',
              timeout: setTimeout(() => {
                setTypingUsers(prev2 => {
                  const next = { ...prev2 };
                  delete next[data.conversationId + ':' + data.userId];
                  return next;
                });
              }, 3000),
            },
          };
        });
      } else {
        setTypingUsers(prev => {
          const next = { ...prev };
          const key = data.conversationId + ':' + data.userId;
          if (next[key]) clearTimeout(next[key].timeout);
          delete next[key];
          return next;
        });
      }
    });

    socket.on('error', (err) => {
      console.warn('Socket error:', typeof err === 'string' ? err : err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [userId, token]);

  // Join/leave conversation room
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    if (conversationId) {
      socket.emit('join:conversation', conversationId);
    }
  }, [conversationId, connected]);

  const sendMessage = useCallback((data: {
    conversationId: string;
    content: string;
    isBuyer?: boolean;
    imageUrl?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
  }) => {
    socketRef.current?.emit('message:send', data);
  }, []);

  const markConversationRead = useCallback((convId: string, isBuyer: boolean) => {
    socketRef.current?.emit('conversation:read', { conversationId: convId, isBuyer });
  }, []);

  const sendTypingStart = useCallback((convId: string) => {
    socketRef.current?.emit('typing:start', convId);
  }, []);

  const sendTypingStop = useCallback((convId: string) => {
    socketRef.current?.emit('typing:stop', convId);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    sendMessage,
    markConversationRead,
    sendTypingStart,
    sendTypingStop,
    typingUsers,
  };
}