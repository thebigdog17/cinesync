import { useState, useEffect } from "react";
import socket from "./socket";
import RoomLobby from "./components/RoomLobby";
import VideoPlayer from "./components/VideoPlayer";
import Chat from "./components/Chat";
import Reactions from "./components/Reactions";
import UserList from "./components/UserList";

export default function App() {
  const [view, setView] = useState("lobby");
  const [currentUser, setCurrentUser] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentMovie, setCurrentMovie] = useState(null);
  const [roomError, setRoomError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [showRoomId, setShowRoomId] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("disconnect", () => setConnectionStatus("disconnected"));
    socket.on("connect_error", () => setConnectionStatus("error"));

    socket.on("room-created", ({ roomId, roomName, user }) => {
      setCurrentUser(user);
      setRoomInfo({ roomId, roomName });
      setRoomError("");
      setView("room");
      setShowRoomId(true);
    });

    socket.on("join-success", ({ roomId, roomName, user, roomState }) => {
      setCurrentUser(user);
      setRoomInfo({ roomId, roomName });
      setCurrentMovie(roomState.currentMovie);
      setRoomError("");
      setView("room");
    });

    socket.on("room-error", ({ message }) => setRoomError(message));

    socket.on("users-update", (updatedUsers) => {
      setUsers(updatedUsers);
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const me = updatedUsers.find((u) => u.id === prev.id);
        return me ? { ...prev, isHost: me.isHost } : prev;
      });
    });

    socket.on("movie-set", ({ movieName }) => {
      setCurrentMovie({ name: movieName });
    });

    return () => {
      socket.off("connect"); socket.off("disconnect"); socket.off("connect_error");
      socket.off("room-created"); socket.off("join-success"); socket.off("room-error");
      socket.off("users-update"); socket.off("movie-set");
    };
  }, []);

  async function wakeServer() {
    try {
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
      await fetch(`${SERVER_URL}/ping`);
    } catch (e) {}
  }

  function ensureConnected(cb) {
    if (!socket.connected) {
      wakeServer().then(() => {
        socket.connect();
        socket.once("connect", cb);
      });
    } else cb();
  }

  function handleCreateRoom(data) {
    setRoomError("");
    ensureConnected(() => socket.emit("create-room", data));
  }

  function handleJoinRoom(data) {
    setRoomError("");
    ensureConnected(() => socket.emit("join-room", data));
  }

  function copyRoomId() {
    navigator.clipboard.writeText(roomInfo?.roomId || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (view === "lobby") {
    return <RoomLobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} error={roomError} />;
  }

  return (
    <div className="grain" style={{
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gridTemplateRows: showRoomId ? "48px 48px 1fr" : "48px 1fr",
      height: "100vh", width: "100vw",
      background: "var(--bg-deep)", overflow: "hidden",
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        gridColumn: "1 / -1", display: "flex", alignItems: "center",
        padding: "0 20px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel)", gap: 16,
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.08em", color: "var(--accent)", flexShrink: 0 }}>
          CINESYNC
        </div>
        <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {roomInfo?.roomName}
          </span>
          {currentMovie?.name && (
            <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              · 🎬 {currentMovie.name}
            </span>
          )}
          <button onClick={() => setShowRoomId((s) => !s)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
            {showRoomId ? "Hide ID" : "Share Room"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: connectionStatus === "connected" ? "var(--green)" : "var(--red)" }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{users.length} watching</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "4px 10px 4px 6px", flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: currentUser?.avatar?.color || "#444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>
            {currentUser?.avatar?.initials}
          </div>
          <span style={{ fontSize: 12 }}>{currentUser?.name}</span>
          {currentUser?.isHost && <span style={{ fontSize: 12 }}>👑</span>}
        </div>
      </div>

      {/* ── Share Banner ── */}
      {showRoomId && (
        <div style={{
          gridColumn: "1 / -1",
          background: "rgba(232,197,71,0.08)", borderBottom: "1px solid rgba(232,197,71,0.2)",
          padding: "0 20px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Room ID:</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.25em", color: "var(--accent)" }}>{roomInfo?.roomId}</span>
          <button onClick={copyRoomId} style={{ background: copied ? "var(--green)" : "var(--accent)", color: "#09090f", border: "none", borderRadius: 6, padding: "4px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>· Share this + your password with friends</span>
          <button onClick={() => setShowRoomId(false)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-secondary)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* ── Video ── */}
      <div style={{ position: "relative", background: "#000", overflow: "hidden" }}>
        <VideoPlayer
          currentUser={currentUser}
          currentMovie={currentMovie}
          onMovieNameSet={(name) => setCurrentMovie({ name })}
        />
        <Reactions />
      </div>

      {/* ── Sidebar ── */}
      <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border)", background: "var(--bg-panel)", overflow: "hidden" }}>
        <UserList users={users} currentUser={currentUser} />
        <div style={{ borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <button style={{ width: "100%", background: "none", border: "none", borderBottom: "2px solid var(--accent)", color: "var(--accent)", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", padding: "10px 0", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            💬 Chat
          </button>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Chat currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
}
