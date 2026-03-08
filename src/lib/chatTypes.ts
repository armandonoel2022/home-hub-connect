export type ChatType = "individual" | "department";

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string; // encrypted
  type: "text" | "audio" | "file" | "buzz";
  fileName?: string;
  fileData?: string; // base64 for files
  timestamp: string;
  read: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string;
  participants: string[]; // user IDs
  departmentId?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export interface ChatNotification {
  id: string;
  chatId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: "message" | "buzz";
}
