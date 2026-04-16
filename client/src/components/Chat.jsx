import { useState, useEffect, useRef } from "react";
import socket from "../socket";

export default function Chat({ currentUser }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onChatMessage(msg) {
      setMessages((prev) => [...prev.slice(-199), msg]);
    }

    function onSystemMessage(msg) {
      setMessages((prev) => [
        ...prev.slice(-199),
        { ...msg, id: `sys-${msg.timestamp}`, isSystem: true },
      ]);
    }

    socket.on("chat-message", onChatMessage);
    socket.on("system-message", onSystemMessage);

    return () => {
      socket.off("chat-message", onChatMessage);
      socket.off("system-message", onSystemMessage);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    socket.emit("chat-message", { text });
    setInput("");
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-panel)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>💬</span>
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 16,
            letterSpacing: "0.1em",
            color: "var(--text-primary)",
          }}
        >
          LIVE CHAT
        </span>
        <span
          style={{
            marginLeft: "auto",
            background: "var(--accent)",
            color: "#09090f",
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: 10,
          }}
        >
          LIVE
        </span>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 40,
            }}
          >
            No messages yet. Say hi! 👋
          </div>
        )}

        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div
                key={msg.id}
                className="msg-in"
                style={{
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: 11,
                  padding: "6px 0",
                  fontStyle: "italic",
                }}
              >
                {msg.text}
              </div>
            );
          }

          const isOwn = msg.userId === currentUser?.id;

          return (
            <div
              key={msg.id}
              className="msg-in"
              style={{
                display: "flex",
                gap: 8,
                padding: "5px 4px",
                borderRadius: 6,
                background: isOwn ? "rgba(232,197,71,0.05)" : "transparent",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: msg.avatar?.color || "#444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {msg.avatar?.initials || msg.name?.slice(0, 2).toUpperCase()}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isOwn ? "var(--accent)" : "var(--text-primary)",
                    }}
                  >
                    {isOwn ? "You" : msg.name}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-primary)",
                    wordBreak: "break-word",
                    lineHeight: 1.4,
                    marginTop: 2,
                  }}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 14px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 8,
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message..."
          maxLength={300}
          style={{
            flex: 1,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "9px 12px",
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
        <button
          onClick={sendMessage}
          style={{
            background: "var(--accent)",
            color: "#09090f",
            border: "none",
            borderRadius: 8,
            padding: "9px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
