import { useState, useEffect } from "react";
import socket from "../socket";

export default function MoviePicker({ currentUser, currentMovie }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const isHost = currentUser?.isHost;

  async function fetchMovies() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/video/list");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMovies(data.movies || []);
    } catch (err) {
      setError("Could not load movies. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }

  function selectMovie(movie) {
    socket.emit("host-change-movie", { movie });
    setOpen(false);
  }

  function handleOpen() {
    setOpen(true);
    fetchMovies();
  }

  if (!isHost) {
    if (!currentMovie) return null;
    return (
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12 }}>🎬</span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentMovie.displayName}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        style={{
          width: "100%",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 14px",
          color: "var(--text-primary)",
          fontSize: 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "border-color 0.2s",
          textAlign: "left",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.borderColor = "var(--accent)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.borderColor = "var(--border)")
        }
      >
        <span>🎬</span>
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentMovie ? currentMovie.displayName : "Pick a movie..."}
        </span>
        <span style={{ color: "var(--accent)", fontSize: 11 }}>▼</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="slide-up"
            style={{
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              width: 480,
              maxWidth: "95vw",
              maxHeight: "70vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: "20px 24px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 22,
                    letterSpacing: "0.1em",
                    color: "var(--accent)",
                  }}
                >
                  SELECT MOVIE
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}
                >
                  From your movies folder on the server
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: 20,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Movie list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {loading && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    padding: "40px 0",
                    fontSize: 13,
                  }}
                >
                  Loading movies...
                </div>
              )}

              {error && (
                <div
                  style={{
                    color: "var(--red)",
                    background: "rgba(232,71,71,0.08)",
                    border: "1px solid rgba(232,71,71,0.2)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontSize: 13,
                    margin: "12px 0",
                  }}
                >
                  {error}
                </div>
              )}

              {!loading && !error && movies.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                  <div>No movies found.</div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    Add .mp4, .mkv or .webm files to the{" "}
                    <code
                      style={{
                        background: "var(--bg-card)",
                        padding: "1px 6px",
                        borderRadius: 4,
                        color: "var(--accent)",
                      }}
                    >
                      server/movies/
                    </code>{" "}
                    folder
                  </div>
                </div>
              )}

              {!loading &&
                movies.map((movie) => {
                  const isActive = currentMovie?.name === movie.name;
                  return (
                    <button
                      key={movie.name}
                      onClick={() => selectMovie(movie)}
                      style={{
                        width: "100%",
                        background: isActive
                          ? "rgba(232,197,71,0.1)"
                          : "var(--bg-card)",
                        border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 8,
                        padding: "12px 16px",
                        marginBottom: 8,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        textAlign: "left",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          e.currentTarget.style.borderColor = "var(--accent)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          e.currentTarget.style.borderColor = "var(--border)";
                      }}
                    >
                      <span style={{ fontSize: 24, flexShrink: 0 }}>
                        {isActive ? "▶" : "🎞"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: isActive ? "var(--accent)" : "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {movie.displayName}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-secondary)",
                            marginTop: 2,
                          }}
                        >
                          {movie.name} · {movie.sizeFormatted}
                        </div>
                      </div>
                      {isActive && (
                        <span
                          style={{
                            background: "var(--accent)",
                            color: "#09090f",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 4,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            flexShrink: 0,
                          }}
                        >
                          NOW PLAYING
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Refresh */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                onClick={fetchMovies}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                ↻ Refresh list
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
