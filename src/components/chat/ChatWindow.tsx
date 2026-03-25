import { useState, useRef, useEffect } from "react";
import { useChatContext, useChatContextSafe } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { decryptMessage } from "@/lib/chatCrypto";
import {
  MessageSquare, X, Send, Vibrate, Paperclip, Mic, MicOff,
  ArrowLeft, Users, User, Search, Building2,
} from "lucide-react";
import { DEPARTMENTS } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Chat List Panel ──
function ChatList({
  onSelectUser,
  onSelectDept,
}: {
  onSelectUser: (id: string) => void;
  onSelectDept: (dept: string) => void;
}) {
  const { allUsers } = useAuth();
  const { user } = useAuth();
  const { chats } = useChatContext();
  const [tab, setTab] = useState<"recent" | "people" | "departments">("recent");
  const [search, setSearch] = useState("");

  const filteredUsers = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["recent", "people", "departments"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-heading font-semibold transition-colors ${
              tab === t
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "recent" ? "Recientes" : t === "people" ? "Personas" : "Departamentos"}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab === "people" && (
        <div className="p-2">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar persona..."
              className="bg-transparent text-sm flex-1 outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {tab === "recent" && (
          <div className="p-1">
            {chats.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No hay conversaciones recientes.
                <br />Inicia un chat desde "Personas" o "Departamentos".
              </p>
            ) : (
              chats.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    c.type === "department" && c.departmentId
                      ? onSelectDept(c.departmentId)
                      : onSelectUser(
                          c.participants.find((p) => p !== user?.id) || ""
                        )
                  }
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    c.type === "department" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
                  }`}>
                    {c.type === "department" ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    {c.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {tab === "people" && (
          <div className="p-1">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => onSelectUser(u.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 overflow-hidden">
                  {u.photoUrl ? (
                    <img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.fullName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{u.department}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === "departments" && (
          <div className="p-1">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => onSelectDept(dept)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">{dept}</p>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Message Bubble ──
function MessageBubble({ msg, isOwn }: { msg: { content: string; type: string; senderName: string; timestamp: string; fileName?: string; fileData?: string }; isOwn: boolean }) {
  const [decrypted, setDecrypted] = useState("");

  useEffect(() => {
    if (msg.type === "text") {
      decryptMessage(msg.content).then(setDecrypted);
    } else if (msg.type === "buzz") {
      setDecrypted("🔔 ¡Zumbido!");
    } else if (msg.type === "audio") {
      setDecrypted("🎤 Mensaje de voz");
    } else {
      setDecrypted(`📎 ${msg.fileName || "Archivo"}`);
    }
  }, [msg]);

  if (msg.type === "buzz") {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-primary font-heading font-semibold px-4 py-1.5 rounded-full bg-primary/10 animate-buzz">
          🔔 {msg.senderName} envió un zumbido
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
        isOwn
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-muted text-foreground rounded-bl-md"
      }`}>
        {!isOwn && (
          <p className="text-[10px] font-semibold opacity-70 mb-0.5">{msg.senderName}</p>
        )}
        {msg.type === "file" && msg.fileData ? (
          <a
            href={msg.fileData}
            download={msg.fileName}
            className="flex items-center gap-2 underline text-sm"
          >
            <Paperclip className="h-4 w-4" />
            {msg.fileName}
          </a>
        ) : msg.type === "audio" && msg.fileData ? (
          <audio controls src={msg.fileData} className="max-w-full" />
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{decrypted}</p>
        )}
        <p className={`text-[10px] mt-1 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ── Active Conversation ──
function ActiveConversation({ onBack }: { onBack: () => void }) {
  const { activeChat, messages, sendMessage, sendBuzz } = useChatContext();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await sendMessage(trimmed, "text");
    setText("");
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    await handleSend();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await sendMessage(file.name, "file", file.name, base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          await sendMessage("audio", "audio", "audio.webm", reader.result as string);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      console.error("No se pudo acceder al micrófono");
    }
  };

  if (!activeChat) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          activeChat.type === "department" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
        }`}>
          {activeChat.type === "department" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-semibold truncate">{activeChat.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {activeChat.type === "department"
              ? `${activeChat.participants.length} participantes`
              : "Chat individual"}
          </p>
        </div>
        <button
          onClick={sendBuzz}
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Enviar zumbido"
        >
          <Vibrate className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-10">
            Inicia la conversación enviando un mensaje.
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} msg={m} isOwn={m.senderId === user?.id} />
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Adjuntar archivo"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <button
            onClick={toggleRecording}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              isRecording
                ? "text-destructive bg-destructive/10 animate-pulse"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={isRecording ? "Detener grabación" : "Grabar audio"}
          >
            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Cifrado AES-256 activo
        </p>
      </div>
    </div>
  );
}

// ── Main Chat Window ──
const ChatWindow = () => {
  const ctx = useChatContextSafe();
  if (!ctx) return null;

  const { isChatOpen, setIsChatOpen, activeChat, setActiveChat, totalUnread, startIndividualChat, startDepartmentChat } = ctx;

  if (!isChatOpen) {
    return (
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        style={{ boxShadow: "0 4px 20px -2px hsla(42, 100%, 50%, 0.4)" }}
      >
        <MessageSquare className="h-6 w-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
            {totalUnread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[380px] h-[520px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5"
      style={{ boxShadow: "0 12px 40px -8px hsla(220, 15%, 18%, 0.25)" }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ background: "var(--gradient-dark)" }}>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="font-heading font-bold text-sm text-secondary-foreground">
            Safe<span className="gold-accent-text">Chat</span>
          </span>
        </div>
        <button
          onClick={() => setIsChatOpen(false)}
          className="p-1 rounded-lg text-muted-foreground hover:text-secondary-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {activeChat ? (
          <ActiveConversation onBack={() => setActiveChat(null)} />
        ) : (
          <ChatList
            onSelectUser={startIndividualChat}
            onSelectDept={startDepartmentChat}
          />
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
