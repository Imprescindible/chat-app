import {
  useState, useEffect, useRef, FormEvent, KeyboardEvent, useCallback,
} from "react";
import { Socket } from "socket.io-client";
import api from "../api/axios";
import { Message, Reaction, Room, User } from "../types";
import Avatar from "./Avatar";

const EMOJIS = ["👍","❤️","😂","😮","😢","🔥","🎉","💯","🤔","👀","😍","👏"];

interface Props {
  room: Room;
  socket: Socket;
  user: User;
  onlineUserIds?: Set<number>;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}
function isImage(mime?: string) { return !!mime?.startsWith("image/"); }

export default function Chat({ room, socket, user, onlineUserIds }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pickerMsgId, setPickerMsgId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);
  const [searching, setSearching] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMessages([]);
    setConfirmClear(false);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults(null);
    socket.emit("join_room", room.id);
    api.get<Message[]>(`/rooms/${room.id}/messages`).then(({ data }) => setMessages(data));

    const handleNew = (msg: Message) => setMessages((prev) => [...prev, msg]);
    const handleCleared = (roomId: number) => { if (roomId === room.id) setMessages([]); };
    const handleReaction = ({ messageId, reactions }: { messageId: number; reactions: Reaction[] }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    };

    socket.on("new_message", handleNew);
    socket.on("messages_cleared", handleCleared);
    socket.on("reaction_updated", handleReaction);

    return () => {
      socket.emit("leave_room", room.id);
      socket.off("new_message", handleNew);
      socket.off("messages_cleared", handleCleared);
      socket.off("reaction_updated", handleReaction);
    };
  }, [room.id, socket]);

  useEffect(() => {
    if (!searchOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, searchOpen]);

  useEffect(() => {
    if (!searchOpen) inputRef.current?.focus();
    else searchRef.current?.focus();
  }, [room.id, searchOpen]);

  const doSearch = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get<Message[]>(
          `/rooms/${room.id}/messages?search=${encodeURIComponent(q)}`
        );
        setSearchResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [room.id]);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    doSearch(q);
  };

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && !pendingFile) return;

    let fileUrl: string | undefined;
    let fileName: string | undefined;
    let fileMime: string | undefined;

    if (pendingFile) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", pendingFile);
        const { data } = await api.post<{ url: string; name: string; mime: string }>("/upload", form);
        fileUrl = data.url;
        fileName = data.name;
        fileMime = data.mime;
      } finally {
        setUploading(false);
        setPendingFile(null);
      }
    }

    socket.emit("send_message", {
      roomId: room.id,
      content: input.trim(),
      fileUrl,
      fileName,
      fileMime,
    });
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await api.delete(`/rooms/${room.id}/messages`);
      setMessages([]);
      socket.emit("room_cleared", room.id);
      setConfirmClear(false);
    } catch { /* keep open */ }
    finally { setClearing(false); }
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    setPickerMsgId(null);
    const { data } = await api.post<{ reactions: Reaction[] }>(
      `/messages/${messageId}/reactions`,
      { emoji }
    );
    socket.emit("reaction_broadcast", { messageId, reactions: data.reactions, roomId: room.id });
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
    );
  };

  const groupReactions = (reactions: Reaction[]) => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      map.set(r.emoji, { count: cur.count + 1, mine: cur.mine || r.userId === user.id });
    }
    return map;
  };

  const displayed = searchOpen && searchResults !== null ? searchResults : messages;

  type Item = { type: "date"; label: string } | { type: "msg"; msg: Message };
  const items: Item[] = [];
  let lastDate = "";
  for (const msg of displayed) {
    const label = fmtDate(msg.createdAt);
    if (label !== lastDate) { items.push({ type: "date", label }); lastDate = label; }
    items.push({ type: "msg", msg });
  }

  const otherUser = room.isPrivate
    ? room.members?.find((m) => m.id !== user.id)
    : null;

  return (
    <div className="chat" onClick={() => setPickerMsgId(null)}>
      <div className="chat-header">
        <div className="chat-header-left">
          {otherUser ? (
            <>
              <Avatar
                name={otherUser.name}
                size={32}
                online={onlineUserIds ? onlineUserIds.has(otherUser.id) : undefined}
              />
              <h2 className="chat-room-name">{otherUser.name}</h2>
            </>
          ) : (
            <>
              <span className="chat-hash">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
                  <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
                </svg>
              </span>
              <h2 className="chat-room-name">{room.name}</h2>
            </>
          )}
        </div>

        <div className="chat-header-right">
          <button
            className={`header-icon-btn ${searchOpen ? "active" : ""}`}
            title="Search messages"
            onClick={(e) => { e.stopPropagation(); setSearchOpen((v) => !v); setSearchQuery(""); setSearchResults(null); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {confirmClear ? (
            <div className="clear-confirm" onClick={(e) => e.stopPropagation()}>
              <span className="clear-confirm-label">Clear all messages?</span>
              <button className="clear-cancel-btn" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancel</button>
              <button className="clear-ok-btn" onClick={handleClear} disabled={clearing}>
                {clearing ? "Clearing…" : "Clear"}
              </button>
            </div>
          ) : (
            <button className="header-icon-btn danger" title="Clear chat history" onClick={(e) => { e.stopPropagation(); setConfirmClear(true); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="search-bar" onClick={(e) => e.stopPropagation()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="search-icon">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            className="search-input"
            placeholder="Search messages…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
          />
          {searching && <span className="search-spinner" />}
          {!searching && searchQuery && (
            <span className="search-count">
              {searchResults?.length ?? 0} result{searchResults?.length !== 1 ? "s" : ""}
            </span>
          )}
          <button className="search-close" onClick={() => setSearchOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="messages">
        {displayed.length === 0 && (
          <div className="messages-empty">
            <div className="messages-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p>{searchOpen ? "No messages found" : "No messages yet. Say hello!"}</p>
          </div>
        )}

        {items.map((item, i) => {
          if (item.type === "date") {
            return (
              <div key={`d-${i}`} className="date-separator">
                <div className="date-separator-line" />
                <span className="date-separator-label">{item.label}</span>
                <div className="date-separator-line" />
              </div>
            );
          }

          const { msg } = item;
          const isOwn = msg.userId === user.id;
          const reactionGroups = groupReactions(msg.reactions ?? []);

          return (
            <div
              key={msg.id}
              className={`msg-row ${isOwn ? "own" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              {!isOwn && (
                <div className="msg-avatar">
                  <Avatar name={msg.user.name} size={42} />
                </div>
              )}

              <div className="msg-body">
                <div className="msg-meta">
                  <span className="msg-author">{isOwn ? "You" : msg.user.name}</span>
                  <span className="msg-time">{fmt(msg.createdAt)}</span>
                </div>

                <div className="msg-bubble-wrap">
                  <div className="msg-bubble">
                    {msg.content && <span className="msg-text">{msg.content}</span>}
                    {msg.fileUrl && (
                      <div className={`msg-attachment ${msg.content ? "has-text" : ""}`}>
                        {isImage(msg.fileMime) ? (
                          <img src={msg.fileUrl} alt={msg.fileName} className="msg-image" />
                        ) : (
                          <a href={msg.fileUrl} download={msg.fileName} className="msg-file-link" target="_blank" rel="noreferrer">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                            </svg>
                            {msg.fileName}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    className="reaction-add-btn"
                    title="Add reaction"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPickerMsgId((id) => (id === msg.id ? null : msg.id));
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" strokeWidth="3" />
                      <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" strokeWidth="3" />
                    </svg>
                  </button>
                </div>

                {pickerMsgId === msg.id && (
                  <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        className="emoji-btn"
                        onClick={() => toggleReaction(msg.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {reactionGroups.size > 0 && (
                  <div className="reaction-list">
                    {[...reactionGroups.entries()].map(([emoji, { count, mine }]) => (
                      <button
                        key={emoji}
                        className={`reaction-pill ${mine ? "mine" : ""}`}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        title={mine ? "Remove reaction" : "Add reaction"}
                      >
                        {emoji} <span>{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        {pendingFile && (
          <div className="file-preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="file-preview-name">{pendingFile.name}</span>
            <span className="file-preview-size">
              {(pendingFile.size / 1024).toFixed(0)} KB
            </span>
            <button className="file-preview-remove" onClick={() => setPendingFile(null)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.target.value = ""; }}
        />

        <form className="input-box" onSubmit={sendMessage}>
          <button
            type="button"
            className={`input-icon-btn ${pendingFile ? "active-file" : ""}`}
            tabIndex={-1}
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            className="input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingFile ? "Add a caption…" : `Message ${room.isPrivate && otherUser ? otherUser.name : "#" + room.name}`}
            rows={1}
          />
          <button type="button" className="input-icon-btn" tabIndex={-1} title="Emoji"
            onClick={() => setPickerMsgId(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" strokeWidth="3" />
              <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" strokeWidth="3" />
            </svg>
          </button>
          <button
            type="submit"
            className={`send-btn ${(input.trim() || pendingFile) && !uploading ? "active" : ""}`}
            disabled={(!input.trim() && !pendingFile) || uploading}
            title="Send"
          >
            {uploading ? (
              <span className="send-spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
        <p className="input-hint">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
