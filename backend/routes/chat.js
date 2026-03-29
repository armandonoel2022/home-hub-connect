/**
 * Chat routes — persists chats and messages in JSON files
 * Files/audio are saved to disk, not in JSON
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { readData, writeData, generateId, UPLOADS_DIR } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

const CHATS_FILE = 'chats.json';
const MESSAGES_FILE = 'chat-messages.json';
const CHAT_UPLOADS_DIR = path.join(UPLOADS_DIR, 'chat');

// Ensure chat uploads dir exists
if (!fs.existsSync(CHAT_UPLOADS_DIR)) fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });

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

/**
 * Save base64 file data to disk and return the URL path.
 */
function saveFileToChat(fileData, fileName, msgId) {
  const ext = path.extname(fileName) || '.bin';
  const safeFileName = `${msgId}${ext}`;
  const filePath = path.join(CHAT_UPLOADS_DIR, safeFileName);

  let buffer;
  if (typeof fileData === 'string' && fileData.includes('base64,')) {
    buffer = Buffer.from(fileData.split('base64,')[1], 'base64');
  } else if (typeof fileData === 'string') {
    buffer = Buffer.from(fileData, 'base64');
  } else {
    buffer = fileData;
  }

  fs.writeFileSync(filePath, buffer);
  return `/uploads/chat/${safeFileName}`;
}

// ── GET /api/chat/messages/:chatId — get messages for a chat ──
router.get('/messages/:chatId', auth, (req, res) => {
  const { chatId } = req.params;
  const since = req.query.since;
  const messages = readData(MESSAGES_FILE);
  let chatMessages = messages.filter(m => m.chatId === chatId);
  if (since) {
    chatMessages = chatMessages.filter(m => m.timestamp > since);
  }
  res.json(chatMessages);
});

// ── GET /api/chat/file/:msgId — serve a chat file by message ID ──
router.get('/file/:msgId', auth, (req, res) => {
  const { msgId } = req.params;
  const messages = readData(MESSAGES_FILE);
  const msg = messages.find(m => m.id === msgId);
  if (!msg || !msg.fileUrl) {
    return res.status(404).json({ message: 'Archivo no encontrado' });
  }
  // fileUrl is like /uploads/chat/MSG-001.pdf
  const filePath = path.join(__dirname, '..', 'data', msg.fileUrl);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Archivo no encontrado en disco' });
  }
  res.sendFile(filePath);
});

// ── POST /api/chat/messages — send a message ──
router.post('/messages', auth, (req, res) => {
  const { chatId, content, type, fileName, fileData, senderName } = req.body;
  const messages = readData(MESSAGES_FILE);
  const msgId = generateId('MSG', messages);

  let fileUrl = null;
  if ((type === 'file' || type === 'audio') && fileData) {
    try {
      fileUrl = saveFileToChat(fileData, fileName || 'file.bin', msgId);
    } catch (err) {
      console.error('Error saving chat file:', err.message);
      return res.status(500).json({ message: 'Error al guardar archivo' });
    }
  }

  const msg = {
    id: msgId,
    chatId,
    senderId: req.user.id,
    senderName: senderName || req.user.fullName || 'Usuario',
    content,
    type: type || 'text',
    fileName: fileName || null,
    fileUrl,  // URL path to file on disk (NOT base64)
    timestamp: new Date().toISOString(),
    read: false,
  };
  messages.push(msg);
  writeData(MESSAGES_FILE, messages);

  // Update chat's lastMessage
  const chats = readData(CHATS_FILE);
  const chatIdx = chats.findIndex(c => c.id === chatId);
  if (chatIdx !== -1) {
    const preview = type === 'text' ? content
      : type === 'buzz' ? '🔔 ¡Zumbido!'
      : type === 'audio' ? '🎤 Audio'
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
