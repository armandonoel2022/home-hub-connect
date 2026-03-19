/**
 * Chat routes — persists chats and messages in JSON files
 * Supports polling-based real-time messaging
 */
const express = require('express');
const { readData, writeData, generateId } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

const CHATS_FILE = 'chats.json';
const MESSAGES_FILE = 'chat-messages.json';

// ── GET /api/chat/chats — get all chats for the current user ──
router.get('/chats', auth, (req, res) => {
  const userId = req.user.id;
  const chats = readData(CHATS_FILE);
  const userChats = chats.filter(c => c.participants.includes(userId));
  res.json(userChats);
});

// ── POST /api/chat/chats — create or find existing chat ──
router.post('/chats', auth, (req, res) => {
  const { type, name, participants, departmentId } = req.body;
  const chats = readData(CHATS_FILE);

  // Try to find existing chat
  let existing;
  if (type === 'individual') {
    existing = chats.find(c =>
      c.type === 'individual' &&
      c.participants.length === 2 &&
      participants.every(p => c.participants.includes(p))
    );
  } else if (type === 'department') {
    existing = chats.find(c => c.type === 'department' && c.departmentId === departmentId);
  }

  if (existing) {
    // Update participants if needed (new dept members)
    if (type === 'department' && participants) {
      const merged = [...new Set([...existing.participants, ...participants])];
      existing.participants = merged;
      writeData(CHATS_FILE, chats);
    }
    return res.json(existing);
  }

  const newChat = {
    id: generateId('CH', chats),
    type,
    name,
    participants: participants || [],
    departmentId: departmentId || null,
    lastMessage: null,
    lastMessageTime: null,
    createdAt: new Date().toISOString(),
  };
  chats.push(newChat);
  writeData(CHATS_FILE, chats);
  res.status(201).json(newChat);
});

// ── GET /api/chat/messages/:chatId — get messages for a chat ──
router.get('/messages/:chatId', auth, (req, res) => {
  const { chatId } = req.params;
  const since = req.query.since; // ISO timestamp for polling
  const messages = readData(MESSAGES_FILE);
  let chatMessages = messages.filter(m => m.chatId === chatId);
  if (since) {
    chatMessages = chatMessages.filter(m => m.timestamp > since);
  }
  res.json(chatMessages);
});

// ── POST /api/chat/messages — send a message ──
router.post('/messages', auth, (req, res) => {
  const { chatId, content, type, fileName, fileData, senderName } = req.body;
  const messages = readData(MESSAGES_FILE);

  const msg = {
    id: generateId('MSG', messages),
    chatId,
    senderId: req.user.id,
    senderName: senderName || req.user.fullName || 'Usuario',
    content,
    type: type || 'text',
    fileName: fileName || null,
    fileData: fileData || null,
    timestamp: new Date().toISOString(),
    read: false,
  };
  messages.push(msg);
  writeData(MESSAGES_FILE, messages);

  // Update chat's lastMessage
  const chats = readData(CHATS_FILE);
  const chatIdx = chats.findIndex(c => c.id === chatId);
  if (chatIdx !== -1) {
    const preview = type === 'text' ? (content || '').slice(0, 50)
      : type === 'buzz' ? '🔔 ¡Zumbido!'
      : `📎 ${fileName || 'Archivo'}`;
    chats[chatIdx].lastMessage = preview;
    chats[chatIdx].lastMessageTime = msg.timestamp;
    writeData(CHATS_FILE, chats);
  }

  res.status(201).json(msg);
});

// ── GET /api/chat/poll — poll for new messages across all user chats ──
router.get('/poll', auth, (req, res) => {
  const userId = req.user.id;
  const since = req.query.since || new Date(0).toISOString();

  const chats = readData(CHATS_FILE);
  const userChatIds = chats
    .filter(c => c.participants.includes(userId))
    .map(c => c.id);

  const messages = readData(MESSAGES_FILE);
  const newMessages = messages.filter(
    m => userChatIds.includes(m.chatId) && m.timestamp > since && m.senderId !== userId
  );

  res.json({
    messages: newMessages,
    chats: chats.filter(c => userChatIds.includes(c.id)),
  });
});

module.exports = router;
