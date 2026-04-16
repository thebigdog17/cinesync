import { useState, useEffect } from "react";
import socket from "../socket";

const EMOJIS = ["😂", "🔥", "😭", "👏", "😱", "❤️", "💀", "🤣", "😍", "👀"];

export default function Reactions() {
  const [floating, setFloating] = useState([]);

  useEffect(() => {
    function onReaction(data) {
      const id = `${Date.now()}-${Math.random()}`;
      setFloating((prev) => [...prev, { ...data, id }]);
      setTimeout(() => {
        setFloating((prev) => prev.filter((r) => r.id !== id));
      }, 2600);
    }

    socket.on("reaction", onReaction);
    return () => socket.off("reaction", onReaction);
  }, []);

  function sendReaction(emoji) {
    socket.emit("reaction", { emoji });
  }

  return (
    <>
      {/* Floating reactions layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 40,
          overflow: "hidden",
        }}
      >
        {floating.map((r) => (
          <div
            key={r.id}
            className="reaction-float"
            style={{ left: `${r.x}%` }}
            title={r.name}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Emoji picker bar — bottom of video */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 45,
          display: "flex",
          gap: 6,
          background: "rgba(9,9,15,0.85)",
          border: "1px solid var(--border)",
          borderRadius: 40,
          padding: "8px 14px",
          backdropFilter: "blur(12px)",
        }}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 6,
              transition: "transform 0.1s",
            }}
            onMouseEnter={(e) => (e.target.style.transform = "scale(1.4)")}
            onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
