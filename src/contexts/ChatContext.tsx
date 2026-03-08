import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { encryptMessage, decryptMessage } from "@/lib/chatCrypto";
import type { Chat, ChatMessage, ChatNotification, ChatType } from "@/lib/chatTypes";
import { DEPARTMENTS } from "@/lib/types";

interface ChatContextType {
  chats: Chat[];
  activeChat: Chat | null;
  messages: ChatMessage[];
  notifications: ChatNotification[];
  setActiveChat: (chat: Chat | null) => void;
  sendMessage: (content: string, type?: ChatMessage["type"], fileName?: string, fileData?: string) => Promise<void>;
  sendBuzz: () => Promise<void>;
  startIndividualChat: (userId: string) => void;
  startDepartmentChat: (department: string) => void;
  dismissNotification: (id: string) => void;
  totalUnread: number;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

const STORAGE_KEY = "safeone_chats";
const MSG_KEY = "safeone_chat_messages";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, allUsers } = useAuth();
  const [chats, setChats] = useState<Chat[]>(() => loadFromStorage(STORAGE_KEY, []));
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() => loadFromStorage(MSG_KEY, []));
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);
  useEffect(() => {
    localStorage.setItem(MSG_KEY, JSON.stringify(allMessages));
  }, [allMessages]);

  // Messages for active chat
  const messages = activeChat
    ? allMessages.filter((m) => m.chatId === activeChat.id)
    : [];

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  const findOrCreateChat = useCallback(
    (type: ChatType, participantIds: string[], name: string, dept?: string): Chat => {
      const existing = chats.find((c) => {
        if (type === "individual") {
          return (
            c.type === "individual" &&
            c.participants.length === 2 &&
            participantIds.every((p) => c.participants.includes(p))
          );
        }
        return c.type === "department" && c.departmentId === dept;
      });
      if (existing) return existing;

      const newChat: Chat = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        name,
        participants: participantIds,
        departmentId: dept,
        unreadCount: 0,
      };
      setChats((prev) => [newChat, ...prev]);
      return newChat;
    },
    [chats]
  );

  const startIndividualChat = useCallback(
    (userId: string) => {
      if (!user) return;
      const other = allUsers.find((u) => u.id === userId);
      if (!other) return;
      const chat = findOrCreateChat("individual", [user.id, userId], other.fullName);
      setActiveChat(chat);
      setIsChatOpen(true);
      // Mark as read
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
      );
    },
    [user, allUsers, findOrCreateChat]
  );

  const startDepartmentChat = useCallback(
    (department: string) => {
      if (!user) return;
      const deptUsers = allUsers.filter((u) => u.department === department).map((u) => u.id);
      if (!deptUsers.includes(user.id)) deptUsers.push(user.id);
      const chat = findOrCreateChat("department", deptUsers, department, department);
      setActiveChat(chat);
      setIsChatOpen(true);
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
      );
    },
    [user, allUsers, findOrCreateChat]
  );

  const sendMessage = useCallback(
    async (content: string, type: ChatMessage["type"] = "text", fileName?: string, fileData?: string) => {
      if (!user || !activeChat) return;
      const encrypted = type === "text" ? await encryptMessage(content) : content;
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        chatId: activeChat.id,
        senderId: user.id,
        senderName: user.fullName,
        content: encrypted,
        type,
        fileName,
        fileData,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setAllMessages((prev) => [...prev, msg]);

      // Update chat last message
      const preview = type === "text" ? content.slice(0, 50) : type === "buzz" ? "🔔 ¡Zumbido!" : `📎 ${fileName || "Archivo"}`;
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, lastMessage: preview, lastMessageTime: msg.timestamp }
            : c
        )
      );
    },
    [user, activeChat]
  );

  const sendBuzz = useCallback(async () => {
    if (!user || !activeChat) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      chatId: activeChat.id,
      senderId: user.id,
      senderName: user.fullName,
      content: "🔔 ¡Zumbido!",
      type: "buzz",
      timestamp: new Date().toISOString(),
      read: false,
    };
    setAllMessages((prev) => [...prev, msg]);
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? { ...c, lastMessage: "🔔 ¡Zumbido!", lastMessageTime: msg.timestamp }
          : c
      )
    );

    // Trigger buzz notification for demo
    const buzzNotif: ChatNotification = {
      id: `notif-${Date.now()}`,
      chatId: activeChat.id,
      senderName: user.fullName,
      message: "¡Te ha enviado un zumbido! 🔔",
      timestamp: new Date().toISOString(),
      type: "buzz",
    };
    setNotifications((prev) => [...prev, buzzNotif]);
  }, [user, activeChat]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChat,
        messages,
        notifications,
        setActiveChat,
        sendMessage,
        sendBuzz,
        startIndividualChat,
        startDepartmentChat,
        dismissNotification,
        totalUnread,
        isChatOpen,
        setIsChatOpen,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
