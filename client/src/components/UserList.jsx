export default function UserList({ users, currentUser }) {
  return (
    <div
      style={{
        padding: "14px 14px 10px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 14,
            letterSpacing: "0.12em",
            color: "var(--text-secondary)",
          }}
        >
          IN THE ROOM
        </span>
        <span
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 11,
            color: "var(--text-secondary)",
            padding: "1px 8px",
          }}
        >
          {users.length}
        </span>
      </div>

      {/* Users */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {users.map((user) => {
          const isYou = user.id === currentUser?.id;
          return (
            <div
              key={user.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 8px",
                borderRadius: 8,
                background: isYou ? "rgba(232,197,71,0.05)" : "transparent",
                border: isYou
                  ? "1px solid rgba(232,197,71,0.15)"
                  : "1px solid transparent",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: user.avatar?.color || "#444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {user.avatar?.initials || user.name?.slice(0, 2).toUpperCase()}
                {/* Online dot */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--green)",
                    border: "1.5px solid var(--bg-panel)",
                  }}
                />
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isYou ? 600 : 400,
                    color: isYou ? "var(--accent)" : "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.name}
                  {isYou && (
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontWeight: 400,
                        fontSize: 11,
                        marginLeft: 5,
                      }}
                    >
                      (you)
                    </span>
                  )}
                </div>
              </div>

              {/* Host crown */}
              {user.isHost && (
                <span
                  className="tooltip"
                  data-tip="Host"
                  style={{ fontSize: 14, flexShrink: 0 }}
                >
                  👑
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
