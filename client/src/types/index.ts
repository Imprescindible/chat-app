export interface User {
  id: number;
  email: string;
  name: string;
}

export interface Room {
  id: number;
  name: string;
  isPrivate: boolean;
  createdAt: string;
  members?: User[];
}

export interface Reaction {
  id: number;
  emoji: string;
  userId: number;
  user: { id: number; name: string };
}

export interface Message {
  id: number;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileMime?: string;
  createdAt: string;
  userId: number;
  roomId: number;
  user: { id: number; name: string; email: string };
  reactions: Reaction[];
}
