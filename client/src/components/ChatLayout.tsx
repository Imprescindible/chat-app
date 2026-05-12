import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import api from "../api/axios";
import { Room, User } from "../types";
import RoomList from "./RoomList";
import Chat from "./Chat";
import Avatar from "./Avatar";

interface Props {
  user: User;
  token: string;
  onLogout: () => void;
}

export default function ChatLayout({ user, token, onLogout }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dmRooms, setDmRooms] = useState<Room[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const currentRoomRef = useRef<Room | null>(null);
  currentRoomRef.current = currentRoom;

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL, { auth: { token } });
    setSocket(s);
    s.on("room_deleted", (roomId: number) => {
      const remove = (list: Room[]) => list.filter((r) => r.id !== roomId);
      setRooms((prev) => { const next = remove(prev); if (currentRoomRef.current?.id === roomId) setCurrentRoom(next[0] ?? null); return next; });
      setDmRooms((prev) => { const next = remove(prev); if (currentRoomRef.current?.id === roomId) setCurrentRoom(next[0] ?? null); return next; });
    });
    s.on("users_online", (ids: number[]) => setOnlineUserIds(new Set(ids)));
    return () => { s.disconnect(); };
  }, [token]);

  useEffect(() => {
    api.get<Room[]>("/rooms").then(({ data }) => {
      const pub = data.filter((r) => !r.isPrivate);
      setRooms(pub);
      if (pub.length > 0) setCurrentRoom(pub[0]);
    });
    api.get<Room[]>("/dm").then(({ data }) => setDmRooms(data));
    api.get<User[]>("/users").then(({ data }) => setAllUsers(data));
  }, []);

  const createRoom = async (name: string) => {
    const { data } = await api.post<Room>("/rooms", { name });
    setRooms((prev) => [data, ...prev]);
    setCurrentRoom(data);
  };

  const deleteRoom = async (roomId: number) => {
    await api.delete(`/rooms/${roomId}`);
    socket?.emit("room_deleted", roomId);
    setRooms((prev) => { const next = prev.filter((r) => r.id !== roomId); if (currentRoomRef.current?.id === roomId) setCurrentRoom(next[0] ?? null); return next; });
    setDmRooms((prev) => { const next = prev.filter((r) => r.id !== roomId); if (currentRoomRef.current?.id === roomId) setCurrentRoom(next[0] ?? null); return next; });
  };

  const openDm = async (userId: number) => {
    setShowUserList(false);
    const { data } = await api.post<Room>("/dm", { userId });
    setDmRooms((prev) => prev.find((r) => r.id === data.id) ? prev : [data, ...prev]);
    setCurrentRoom(data);
  };

  const otherUser = (dmRoom: Room) => dmRoom.members?.find((m) => m.id !== user.id);

  return (
    <div className="chat-layout" onClick={() => setShowUserList(false)}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <span className="sidebar-app-name">ChatApp</span>
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-rooms">
          <RoomList
            rooms={rooms}
            currentRoom={currentRoom}
            onSelectRoom={setCurrentRoom}
            onCreateRoom={createRoom}
            onDeleteRoom={deleteRoom}
          />
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-dm">
          <div className="room-section-header">
            <span>Direct Messages</span>
            <div className="dm-add-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                className="add-room-btn"
                title="New direct message"
                onClick={() => setShowUserList((v) => !v)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              {showUserList && (
                <div className="user-list-popup">
                  {allUsers.length === 0 && (
                    <div className="user-list-empty">No other users yet</div>
                  )}
                  {allUsers.map((u) => (
                    <button key={u.id} className="user-list-item" onClick={() => openDm(u.id)}>
                      <Avatar name={u.name} size={28} online={onlineUserIds.has(u.id)} />
                      <span>{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ul className="room-ul">
            {dmRooms.map((dm) => {
              const other = otherUser(dm);
              return (
                <li
                  key={dm.id}
                  className={`room-item dm-item ${currentRoom?.id === dm.id ? "active" : ""}`}
                  onClick={() => setCurrentRoom(dm)}
                >
                  <Avatar
                    name={other?.name ?? "?"}
                    size={26}
                    online={other ? onlineUserIds.has(other.id) : undefined}
                  />
                  <span className="room-item-name">{other?.name ?? "Unknown"}</span>
                  <button
                    className="room-item-delete-btn"
                    title="Delete conversation"
                    onClick={(e) => { e.stopPropagation(); deleteRoom(dm.id); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  </button>
                </li>
              );
            })}
            {dmRooms.length === 0 && (
              <li className="room-item-empty">No conversations yet</li>
            )}
          </ul>
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-user-panel">
          <Avatar name={user.name} size={38} online={true} />
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-email">{user.email}</div>
          </div>
          <button className="sidebar-logout-btn" onClick={onLogout} title="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="chat-main">
        {currentRoom && socket ? (
          <Chat room={currentRoom} socket={socket} user={user} onlineUserIds={onlineUserIds} />
        ) : (
          <div className="no-room">
            <div className="no-room-inner">
              <div className="no-room-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <h3>Welcome to ChatApp</h3>
              <p>{rooms.length === 0 ? "Create a channel to get started" : "Select a channel or start a DM"}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
