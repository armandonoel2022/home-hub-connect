import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { encryptMessage, decryptMessage } from "@/lib/chatCrypto";
import { isApiConfigured, chatApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
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

export function useChatContextSafe() {
  return useContext(ChatContext);
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
  const apiMode = isApiConfigured();
  const [chats, setChats] = useState<Chat[]>(() => loadFromStorage(STORAGE_KEY, []));
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() => loadFromStorage(MSG_KEY, []));
  const [activeChat, setActiveChatRaw] = useState<Chat | null>(null);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const lastPollRef = useRef<string>(new Date().toISOString());
  const pollErrorCount = useRef(0);
  const activeChatRef = useRef<Chat | null>(null);

  // Keep ref in sync so poll callback sees current active chat
  const setActiveChat = useCallback((chat: Chat | null) => {
    setActiveChatRaw(chat);
    activeChatRef.current = chat;
    // Clear notifications for this chat when opening it
    if (chat) {
      setNotifications(prev => prev.filter(n => n.chatId !== chat.id));
    }
  }, []);

  // Persist to localStorage only in mock mode
  useEffect(() => {
    if (!apiMode) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats, apiMode]);
  useEffect(() => {
    if (!apiMode) localStorage.setItem(MSG_KEY, JSON.stringify(allMessages));
  }, [allMessages, apiMode]);

  // Load chats from server on mount
  useEffect(() => {
    if (!apiMode || !user) return;
    chatApi.getChats().then(setChats).catch(() => {});
  }, [apiMode, user]);

  // Track which message IDs we've already notified about
  const notifiedMsgIds = useRef<Set<string>>(new Set());

  // Poll for new messages every 5 seconds (with backoff on errors)
  useEffect(() => {
    if (!apiMode || !user) return;
    let polling = false; // prevent overlapping polls

    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await chatApi.poll(lastPollRef.current);
        pollErrorCount.current = 0;
        if (result.messages.length > 0) {
          setAllMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = result.messages.filter(m => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;

            // Notify only for truly new messages from other users
            const msgsToNotify = newMsgs.filter(m =>
              m.senderId !== user?.id && !notifiedMsgIds.current.has(m.id)
            );

            // Group notifications by sender to avoid flooding
            const bySender = new Map<string, typeof msgsToNotify>();
            msgsToNotify.forEach(m => {
              // Skip if this chat is currently open and visible
              const currentActive = activeChatRef.current;
              if (isChatOpen && currentActive && currentActive.id === m.chatId) {
                notifiedMsgIds.current.add(m.id);
                return;
              }
              notifiedMsgIds.current.add(m.id);
              const key = `${m.chatId}-${m.senderName}`;
              if (!bySender.has(key)) bySender.set(key, []);
              bySender.get(key)!.push(m);
            });

            // Create one notification per sender-chat group (latest message)
            bySender.forEach((msgs) => {
              const latest = msgs[msgs.length - 1];
              const count = msgs.length;

              const createNotif = async () => {
                let preview: string;
                if (latest.type === "buzz") {
                  preview = "¡Te ha enviado un zumbido! 🔔";
                } else if (latest.type === "audio") {
                  preview = "🎤 Mensaje de voz";
                } else if (latest.type === "file") {
                  preview = `📎 ${latest.fileName || "Archivo"}`;
                } else {
                  try {
                    const decrypted = await decryptMessage(latest.content || "");
                    preview = decrypted.slice(0, 50);
                  } catch {
                    preview = "Nuevo mensaje";
                  }
                }
                if (count > 1) preview = `(${count}) ${preview}`;

                const notif: ChatNotification = {
                  id: `notif-${latest.id}`,
                  chatId: latest.chatId,
                  senderName: latest.senderName,
                  message: preview,
                  timestamp: latest.timestamp,
                  type: latest.type === "buzz" ? "buzz" : "message",
                };
                // Replace existing notification from same chat, keep max 5
                setNotifications(p => {
                  const filtered = p.filter(n => n.chatId !== latest.chatId);
                  return [...filtered.slice(-4), notif];
                });
              };
              createNotif();
            });

            lastPollRef.current = newMsgs[newMsgs.length - 1].timestamp;
            return [...prev, ...newMsgs];
          });
          setChats(result.chats);
        }
      } catch {
        pollErrorCount.current++;
      } finally {
        polling = false;
      }
    };

    const getInterval = () => {
      if (pollErrorCount.current > 10) return 30000;
      if (pollErrorCount.current > 5) return 15000;
      return 5000;
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    const schedulePoll = () => {
      timeoutId = setTimeout(async () => {
        await poll();
        schedulePoll();
      }, getInterval());
    };
    schedulePoll();

    return () => clearTimeout(timeoutId);
  }, [apiMode, user]);

  // Messages for active chat
  const messages = activeChat
    ? allMessages.filter((m) => m.chatId === activeChat.id)
    : [];

  const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  // Load messages when switching active chat
  useEffect(() => {
    if (!apiMode || !activeChat) return;
    chatApi.getMessages(activeChat.id).then(msgs => {
      setAllMessages(prev => {
        const otherMsgs = prev.filter(m => m.chatId !== activeChat.id);
        return [...otherMsgs, ...msgs];
      });
      if (msgs.length > 0) {
        lastPollRef.current = msgs[msgs.length - 1].timestamp;
      }
    }).catch(() => {});
  }, [apiMode, activeChat?.id]);

  const findOrCreateChat = useCallback(
    async (type: ChatType, participantIds: string[], name: string, dept?: string): Promise<Chat> => {
      if (apiMode) {
        try {
          const chat = await chatApi.findOrCreateChat({
            type,
            name,
            participants: participantIds,
            departmentId: dept,
          });
          setChats(prev => {
            const exists = prev.find(c => c.id === chat.id);
            if (exists) return prev;
            return [chat, ...prev];
          });
          return chat;
        } catch (err) {
          console.error("Error creating chat:", err);
          toast({ title: "Modo local", description: "No se pudo conectar al servidor del chat; usaré almacenamiento local en este equipo.", variant: "destructive" });
        }
      }

      // Fallback: local mode
      const existing = chats.find((c) => {
        if (type === "individual") {
          return c.type === "individual" && c.participants.length === 2 &&
            participantIds.every((p) => c.participants.includes(p));
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
    [chats, apiMode]
  );

  const startIndividualChat = useCallback(
    async (userId: string) => {
      if (!user) return;
      const other = allUsers.find((u) => u.id === userId);
      if (!other) return;
      const chat = await findOrCreateChat("individual", [user.id, userId], other.fullName);
      setActiveChat(chat);
      setIsChatOpen(true);
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
      );
    },
    [user, allUsers, findOrCreateChat]
  );

  const startDepartmentChat = useCallback(
    async (department: string) => {
      if (!user) return;
      const deptUsers = allUsers.filter((u) => u.department === department).map((u) => u.id);
      if (!deptUsers.includes(user.id)) deptUsers.push(user.id);
      const chat = await findOrCreateChat("department", deptUsers, department, department);
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

      if (apiMode) {
        try {
          const msg = await chatApi.sendMessage({
            chatId: activeChat.id,
            content: encrypted,
            type,
            senderName: user.fullName,
            fileName,
            fileData,
          });
          setAllMessages(prev => [...prev, msg]);
          const preview = type === "text" ? content.slice(0, 50) : type === "buzz" ? "🔔 ¡Zumbido!" : `📎 ${fileName || "Archivo"}`;
          setChats(prev =>
            prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: preview, lastMessageTime: msg.timestamp } : c)
          );
          return;
        } catch (err) {
          console.error("Error sending message via API, using local fallback:", err);
          toast({ title: "Modo local", description: "El servidor del chat no respondió; el mensaje se guardó solo en este equipo.", variant: "destructive" });
          // Fall through to local mode below
        }
      }

      // Local mode only when no API configured
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
      const preview = type === "text" ? content.slice(0, 50) : type === "buzz" ? "🔔 ¡Zumbido!" : `📎 ${fileName || "Archivo"}`;
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id ? { ...c, lastMessage: preview, lastMessageTime: msg.timestamp } : c
        )
      );
    },
    [user, activeChat, apiMode]
  );

  const sendBuzz = useCallback(async () => {
    await sendMessage("🔔 ¡Zumbido!", "buzz");
  }, [sendMessage]);

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
