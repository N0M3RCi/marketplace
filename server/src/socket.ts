import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { sanitizeText } from './middleware/sanitizer.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn(
      'WARNING: JWT_SECRET environment variable is not set. ' +
      'Using a hardcoded fallback is INSECURE for production. ' +
      'Set JWT_SECRET in your environment (e.g. openssl rand -hex 32).'
    );
    return 'safeescrow-dev-secret-key-change-in-production';
  }
  return secret;
}
const JWT_SECRET = getJwtSecret();

interface SocketUser {
  userId: string;
  username: string;
}

export function setupSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const decoded = jwt.verify(token as string, JWT_SECRET) as any;
      // Look up username from database since JWT only stores userId+role
      const userResult = await pool.query(
        'SELECT username FROM user_profiles WHERE id = $1',
        [decoded.userId]
      );
      const username = userResult.rows[0]?.username || 'User';
      (socket as any).user = { userId: decoded.userId, username };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as SocketUser;
    console.log(`Socket connected: ${user.username} (${user.userId})`);

    // Join user to their personal room for notifications
    socket.join(`user:${user.userId}`);

    // Join conversation rooms
    socket.on('join:conversation', async (conversationId: string) => {
      // Verify user is a participant
      try {
        const result = await pool.query(
          'SELECT buyer_id, seller_id FROM conversations WHERE id = $1',
          [conversationId]
        );
        if (result.rows.length === 0) {
          socket.emit('error', 'Conversation not found');
          return;
        }
        const conv = result.rows[0];
        if (conv.buyer_id !== user.userId && conv.seller_id !== user.userId) {
          // Check if admin
          const adminCheck = await pool.query(
            'SELECT role FROM user_profiles WHERE id = $1',
            [user.userId]
          );
          if (adminCheck.rows[0]?.role !== 'admin') {
            socket.emit('error', 'Not a participant in this conversation');
            return;
          }
        }
        socket.join(`conv:${conversationId}`);
        console.log(`${user.username} joined conversation ${conversationId}`);
      } catch (err) {
        socket.emit('error', 'Failed to join conversation');
      }
    });

    // Send message
    socket.on('message:send', async (data: {
      conversationId: string;
      content: string;
      isBuyer?: boolean;
      imageUrl?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
    }, callback?: (response: { ok: boolean; error?: string }) => void) => {
      const { conversationId, content, isBuyer, imageUrl, fileUrl, fileName, fileSize } = data;
      const safeContent = sanitizeText(content || '', 5000);
      if (!conversationId || !safeContent) {
        callback?.({ ok: false, error: 'Conversation ID and content are required' });
        return;
      }

      try {
        const { v4: uuid } = await import('uuid');
        const id = uuid();

        // Insert message
        const result = await pool.query(
          `INSERT INTO messages (id, conversation_id, sender_id, content, image_url, file_url, file_name, file_size)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [id, conversationId, user.userId, safeContent,
           imageUrl || null, fileUrl || null, fileName || null, fileSize || null]
        );

        // Update conversation
        const unreadField = isBuyer ? 'seller_unread' : 'buyer_unread';
        await pool.query(
          `UPDATE conversations SET last_message = $1, last_message_at = NOW(),
           updated_at = NOW(), ${unreadField} = ${unreadField} + 1 WHERE id = $2`,
          [safeContent.substring(0, 100), conversationId]
        );

        const msg = result.rows[0];
        const messageData = {
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          senderName: user.username,
          content: msg.content,
          imageUrl: msg.image_url,
          fileUrl: msg.file_url,
          fileName: msg.file_name,
          fileSize: msg.file_size,
          isRead: msg.is_read,
          createdAt: msg.created_at,
        };

        // Acknowledge success to sender
        callback?.({ ok: true });

        // Emit to conversation room
        io.to(`conv:${conversationId}`).emit('message:new', messageData);

        // Notify the other participant
        const convResult = await pool.query(
          'SELECT buyer_id, seller_id FROM conversations WHERE id = $1',
          [conversationId]
        );
        if (convResult.rows.length > 0) {
          const conv = convResult.rows[0];
          const otherUserId = conv.buyer_id === user.userId ? conv.seller_id : conv.buyer_id;
          io.to(`user:${otherUserId}`).emit('notification:new', {
            type: 'message',
            title: `New message from ${user.username}`,
            conversationId,
          });
        }
      } catch (err: any) {
        callback?.({ ok: false, error: 'Failed to send message: ' + err.message });
        socket.emit('error', 'Failed to send message: ' + err.message);
      }
    });

    // Mark conversation as read
    socket.on('conversation:read', async (data: { conversationId: string; isBuyer: boolean }) => {
      try {
        const field = data.isBuyer ? 'buyer_unread' : 'seller_unread';
        await pool.query(
          `UPDATE conversations SET ${field} = 0 WHERE id = $1`,
          [data.conversationId]
        );
        io.to(`conv:${data.conversationId}`).emit('conversation:read-update', {
          conversationId: data.conversationId,
          readBy: user.userId,
        });
      } catch (err) {
        console.error('Failed to mark conversation read:', err);
      }
    });

    // Typing indicators
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit('typing:update', {
        conversationId,
        userId: user.userId,
        username: user.username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit('typing:update', {
        conversationId,
        userId: user.userId,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user.username}`);
    });
  });

  return io;
}