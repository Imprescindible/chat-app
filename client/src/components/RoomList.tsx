import { useState, FormEvent, useRef, useEffect } from "react";
import { Room } from "../types";

interface Props {
  rooms: Room[];
  currentRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  onCreateRoom: (name: string) => Promise<void>;
  onDeleteRoom: (roomId: number) => Promise<void>;
}

export default function RoomList({
  rooms,
  currentRoom,
  onSelectRoom,
  onCreateRoom,
  onDeleteRoom,
}: Props) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateLoading(true);
    try {
      await onCreateRoom(newName.trim());
      setNewName("");
      setCreating(false);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (roomId: number) => {
    setDeleteLoading(true);
    try {
      await onDeleteRoom(roomId);
      setConfirmDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const cancel = () => {
    setCreating(false);
    setNewName("");
  };

  return (
    <div className="room-list">
      <div className="room-section-header">
        <span>Channels</span>
        <button
          className="add-room-btn"
          onClick={() => setCreating((v) => !v)}
          title="New channel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="create-room-form">
          <div className="create-room-input-wrap">
            <span className="create-room-hash">#</span>
            <input
              ref={inputRef}
              placeholder="channel-name"
              value={newName}
              onChange={(e) =>
                setNewName(e.target.value.toLowerCase().replace(/\s+/g, "-"))
              }
              onKeyDown={(e) => e.key === "Escape" && cancel()}
            />
          </div>
          <div className="create-room-actions">
            <button type="button" className="create-room-cancel" onClick={cancel}>
              Cancel
            </button>
            <button
              type="submit"
              className="create-room-confirm"
              disabled={createLoading || !newName.trim()}
            >
              {createLoading ? "…" : "Create"}
            </button>
          </div>
        </form>
      )}

      <ul className="room-ul">
        {rooms.map((room) => (
          <li
            key={room.id}
            className={`room-item ${currentRoom?.id === room.id ? "active" : ""} ${confirmDeleteId === room.id ? "confirming" : ""}`}
            onClick={() => confirmDeleteId !== room.id && onSelectRoom(room)}
          >
            {confirmDeleteId === room.id ? (
              <div
                className="room-delete-confirm"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="room-delete-confirm-text">Delete channel?</span>
                <button
                  className="room-delete-no"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={deleteLoading}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <button
                  className="room-delete-yes"
                  onClick={() => handleDelete(room.id)}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "…" : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              <>
                <span className="room-item-hash">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="4" y1="9" x2="20" y2="9" />
                    <line x1="4" y1="15" x2="20" y2="15" />
                    <line x1="10" y1="3" x2="8" y2="21" />
                    <line x1="16" y1="3" x2="14" y2="21" />
                  </svg>
                </span>
                <span className="room-item-name">{room.name}</span>
                <button
                  className="room-item-delete-btn"
                  title="Delete channel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(room.id);
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </>
            )}
          </li>
        ))}

        {rooms.length === 0 && !creating && (
          <li className="room-item-empty">No channels yet</li>
        )}
      </ul>
    </div>
  );
}
