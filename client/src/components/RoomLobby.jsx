import { useState } from "react";

export default function RoomLobby({ onCreateRoom, onJoinRoom, error }) {
  const [tab, setTab] = useState("create"); // "create" | "join"
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit() {
    if (!name.trim()) return;
    if (tab === "create") {
      if (!roomName.trim() || !password.trim()) return;
      setLoading(true);
      onCreateRoom({ name: name.trim(), roomName: roomName.trim(), password });
    } else {
      if (!roomId.trim() || !password.trim()) return;
      setLoading(true);
      onJoinRoom({ name: name.trim(), roomId: roomId.trim().toUpperCase(), password });
    }
  }

  // Reset loading if error came back
  if (error && loading) setLoading(false);

  function handleKey(e) { if (e.key === "Enter") handleSubmit(); }

  const inputStyle = {
    width: "100%", background: "var(--bg-card)",
    border: "1px solid var(--border)", borderRadius: 8,
    padding: "12px 16px", color: "var(--text-primary)",
    fontSize: 15, outline: "none",
  };
  const labelStyle = {
    fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "var(--text-secondary)", display: "block", marginBottom: 8,
  };

  return (
    <div style={{ background: "var(--bg-deep)" }}
      className="h-screen w-screen flex items-center justify-center relative overflow-hidden grain">
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 60px,var(--border) 60px,var(--border) 62px),repeating-linear-gradient(90deg,transparent,transparent 80px,var(--border) 80px,var(--border) 82px)`
      }} />
      <div className="absolute" style={{
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,197,71,0.07) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none"
      }} />

      <div className="slide-up relative z-10 w-full max-w-md" style={{
        background: "var(--bg-panel)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "44px 40px",
      }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: "0.05em", lineHeight: 1, color: "var(--accent)" }}>
            CINESYNC
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 5, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Watch movies together · live
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 28 }}>
          {["create", "join"].map((t) => (
            <button key={t} onClick={() => { setTab(t); setLoading(false); }}
              style={{
                flex: 1, padding: "11px 0", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                background: tab === t ? "var(--accent)" : "var(--bg-card)",
                color: tab === t ? "#09090f" : "var(--text-secondary)",
              }}>
              {t === "create" ? "🎬 Create Room" : "🚪 Join Room"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          {/* Name always shown */}
          <div>
            <label style={labelStyle}>Your Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKey} placeholder="e.g. Dior" maxLength={20} style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
          </div>

          {tab === "create" ? (
            <div>
              <label style={labelStyle}>Room Name</label>
              <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={handleKey} placeholder="e.g. Friday Night Cinema" maxLength={40} style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Room ID</label>
              <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                onKeyDown={handleKey} placeholder="e.g. AB12CD" maxLength={10}
                style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 600 }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
            </div>
          )}

          <div>
            <label style={labelStyle}>{tab === "create" ? "Set a Password" : "Room Password"}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKey}
              placeholder={tab === "create" ? "Friends will need this to join" : "Ask the host"}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
          </div>

          {error && (
            <div style={{ color: "var(--red)", fontSize: 13, padding: "8px 12px", background: "rgba(232,71,71,0.08)", border: "1px solid rgba(232,71,71,0.2)", borderRadius: 6 }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} className="pulse-glow"
            style={{
              marginTop: 4, background: loading ? "var(--accent-dim)" : "var(--accent)",
              color: "#09090f", border: "none", borderRadius: 8, padding: "14px",
              fontSize: 14, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>
            {loading ? "Please wait..." : tab === "create" ? "Create Room & Host →" : "Join Party →"}
          </button>
        </div>

        <p style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center", marginTop: 22 }}>
          {tab === "create" ? "You'll get a Room ID to share with friends 👑" : "Get the Room ID and password from the host"}
        </p>
      </div>
    </div>
  );
}
