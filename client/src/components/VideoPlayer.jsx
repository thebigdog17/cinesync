import { useRef, useEffect, useState, useCallback } from "react";
import socket from "../socket";

// WebRTC config - using public STUN servers
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({ currentUser, currentMovie, onMovieNameSet }) {
  const videoRef = useRef(null);
  const progressRef = useRef(null);
  const fileRef = useRef(null); // the actual local File object (host only)

  // WebRTC: host holds a map of viewerId → RTCPeerConnection
  const peerConns = useRef({});
  // WebRTC: viewer holds one RTCPeerConnection to the host
  const viewerConn = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [movieName, setMovieName] = useState(currentMovie?.name || null);
  const [streamReady, setStreamReady] = useState(false); // viewer: stream received
  const [loadingStream, setLoadingStream] = useState(false);

  const controlsTimer = useRef(null);
  const isHost = currentUser?.isHost;

  // ── Mouse idle hides controls ─────────────────────────────────────────────
  function handleMouseMove() {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }

  // ── HOST: pick file from PC ───────────────────────────────────────────────
  function handleFilePick(e) {
    const file = e.target.files[0];
    if (!file) return;
    fileRef.current = file;

    const url = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }

    const name = file.name.replace(/\.[^/.]+$/, "").replace(/[._-]/g, " ");
    setMovieName(name);
    onMovieNameSet?.(name);
    socket.emit("host-set-movie", { movieName: name });

    // Re-create peer connections for all current viewers with the new stream
    setTimeout(() => setupHostStream(), 500);
  }

  // ── HOST: create MediaSource stream and offer to a viewer ────────────────
  async function createPeerForViewer(viewerId) {
    // Close existing connection if any
    if (peerConns.current[viewerId]) {
      peerConns.current[viewerId].close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConns.current[viewerId] = pc;

    // Capture video element stream
    let stream;
    try {
      stream = videoRef.current.captureStream
        ? videoRef.current.captureStream()
        : videoRef.current.mozCaptureStream();
    } catch (err) {
      console.error("captureStream failed:", err);
      return;
    }

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("webrtc-ice", { targetId: viewerId, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        delete peerConns.current[viewerId];
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { viewerId, offer });
  }

  // ── HOST: set up stream for ALL existing viewers ──────────────────────────
  function setupHostStream() {
    Object.keys(peerConns.current).forEach((viewerId) => {
      createPeerForViewer(viewerId);
    });
  }

  // ── HOST: play ────────────────────────────────────────────────────────────
  function handlePlay() {
    const v = videoRef.current;
    if (!v || !isHost) return;
    v.play();
    setIsPlaying(true);
    socket.emit("host-play", { currentTime: v.currentTime });
  }

  // ── HOST: pause ───────────────────────────────────────────────────────────
  function handlePause() {
    const v = videoRef.current;
    if (!v || !isHost) return;
    v.pause();
    setIsPlaying(false);
    socket.emit("host-pause", { currentTime: v.currentTime });
  }

  function togglePlay() {
    if (!isHost) return;
    isPlaying ? handlePause() : handlePlay();
  }

  // ── HOST: seek ────────────────────────────────────────────────────────────
  function handleSeek(e) {
    if (!isHost) return;
    const v = videoRef.current;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    socket.emit("host-seek", { currentTime: v.currentTime });
  }

  // ── Volume ────────────────────────────────────────────────────────────────
  function handleVolumeChange(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
    setMuted(v === 0);
  }

  function toggleMute() {
    setMuted((m) => {
      if (videoRef.current) videoRef.current.muted = !m;
      return !m;
    });
  }

  // ── Fullscreen ────────────────────────────────────────────────────────────
  function toggleFullscreen() {
    const el = videoRef.current?.parentElement?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  }

  // ── Time update ───────────────────────────────────────────────────────────
  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
    }
  }

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost) return;

    // A new viewer joined — create a peer connection for them
    function onViewerJoined({ viewerId, viewerName }) {
      console.log(`[WebRTC] Viewer joined: ${viewerName}`);
      // Register viewer slot
      peerConns.current[viewerId] = null;
      // Only offer if we have a file loaded
      if (fileRef.current && videoRef.current?.src) {
        createPeerForViewer(viewerId);
      }
    }

    // Viewer sent us their answer
    function onAnswer({ viewerId, answer }) {
      const pc = peerConns.current[viewerId];
      if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    // ICE candidate from a viewer
    function onIce({ fromId, candidate }) {
      const pc = peerConns.current[fromId];
      if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }

    function onPeerDisconnected({ peerId }) {
      const pc = peerConns.current[peerId];
      if (pc) { pc.close(); delete peerConns.current[peerId]; }
    }

    socket.on("viewer-joined", onViewerJoined);
    socket.on("webrtc-answer", onAnswer);
    socket.on("webrtc-ice", onIce);
    socket.on("peer-disconnected", onPeerDisconnected);

    return () => {
      socket.off("viewer-joined", onViewerJoined);
      socket.off("webrtc-answer", onAnswer);
      socket.off("webrtc-ice", onIce);
      socket.off("peer-disconnected", onPeerDisconnected);
    };
  }, [isHost]);

  useEffect(() => {
    if (isHost) return;

    // Host offered us a stream
    async function onOffer({ hostId, offer }) {
      console.log("[WebRTC] Received offer from host");
      setLoadingStream(true);

      if (viewerConn.current) viewerConn.current.close();

      const pc = new RTCPeerConnection(RTC_CONFIG);
      viewerConn.current = pc;

      pc.ontrack = (e) => {
        console.log("[WebRTC] Stream received!");
        const stream = e.streams[0];
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setStreamReady(true);
          setLoadingStream(false);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("webrtc-ice", { targetId: hostId, candidate: e.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          setLoadingStream(false);
          setStreamReady(false);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { hostId, answer });
    }

    // ICE from host
    async function onIce({ fromId, candidate }) {
      const pc = viewerConn.current;
      if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }

    function onSyncPlay({ currentTime }) {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = currentTime;
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    function onSyncPause({ currentTime }) {
      const v = videoRef.current;
      if (!v) return;
      v.pause(); v.currentTime = currentTime; setIsPlaying(false);
    }

    function onSyncSeek({ currentTime }) {
      if (videoRef.current) videoRef.current.currentTime = currentTime;
    }

    function onMovieSet({ movieName }) {
      setMovieName(movieName);
      setStreamReady(false);
      setLoadingStream(true);
    }

    function onHostChanged({ newHostId }) {
      // If this viewer becomes host, nothing to do for now
    }

    function onPeerDisconnected() {
      if (viewerConn.current) { viewerConn.current.close(); viewerConn.current = null; }
      setStreamReady(false); setLoadingStream(false);
    }

    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-ice", onIce);
    socket.on("sync-play", onSyncPlay);
    socket.on("sync-pause", onSyncPause);
    socket.on("sync-seek", onSyncSeek);
    socket.on("movie-set", onMovieSet);
    socket.on("host-changed", onHostChanged);
    socket.on("peer-disconnected", onPeerDisconnected);

    // Ask for current state
    socket.emit("request-sync");

    return () => {
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-ice", onIce);
      socket.off("sync-play", onSyncPlay);
      socket.off("sync-pause", onSyncPause);
      socket.off("sync-seek", onSyncSeek);
      socket.off("movie-set", onMovieSet);
      socket.off("host-changed", onHostChanged);
      socket.off("peer-disconnected", onPeerDisconnected);
    };
  }, [isHost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(peerConns.current).forEach((pc) => pc?.close());
      if (viewerConn.current) viewerConn.current.close();
    };
  }, []);

  const progress = duration ? (currentTime / duration) * 100 : 0;

  // ── EMPTY STATE ───────────────────────────────────────────────────────────
  if (!movieName && !isHost) {
    return (
      <div className="flex items-center justify-center w-full h-full" style={{ background: "var(--bg-deep)" }}>
        <div className="text-center">
          <div style={{ fontSize: 64 }}>🎬</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-secondary)", marginTop: 12, letterSpacing: "0.1em" }}>
            Waiting for the host...
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>Grab some popcorn 🍿</div>
        </div>
      </div>
    );
  }

  if (!movieName && isHost) {
    return (
      <div className="flex items-center justify-center w-full h-full" style={{ background: "var(--bg-deep)" }}>
        <div className="text-center">
          <div style={{ fontSize: 64 }}>📂</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-secondary)", marginTop: 12, letterSpacing: "0.1em" }}>
            Pick a movie to begin
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8, marginBottom: 28 }}>
            Select any video file from your PC
          </div>
          <label style={{
            display: "inline-block", background: "var(--accent)", color: "#09090f",
            borderRadius: 8, padding: "13px 28px", fontSize: 14, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
          }}>
            Choose File
            <input type="file" accept="video/*" onChange={handleFilePick} style={{ display: "none" }} />
          </label>
        </div>
      </div>
    );
  }

  // ── VIEWER: waiting for stream ────────────────────────────────────────────
  if (!isHost && !streamReady) {
    return (
      <div className="flex items-center justify-center w-full h-full" style={{ background: "#000" }}>
        <div className="text-center">
          {loadingStream ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--text-secondary)", letterSpacing: "0.1em" }}>
                Connecting to host stream...
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
                {movieName}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--text-secondary)", letterSpacing: "0.1em" }}>
                Host is loading a movie...
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── VIDEO PLAYER ──────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full" onMouseMove={handleMouseMove}
      style={{ background: "#000", cursor: showControls ? "default" : "none" }}>

      <video ref={videoRef} className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        playsInline
      />

      {/* Controls */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.92))",
        padding: "50px 20px 16px",
        transition: "opacity 0.3s", opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? "auto" : "none",
      }}>
        {/* Progress */}
        <div ref={progressRef} onClick={isHost ? handleSeek : undefined}
          style={{ height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2, marginBottom: 12, cursor: isHost ? "pointer" : "default", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${buffered}%`, background: "rgba(255,255,255,0.2)", borderRadius: 2 }} />
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${progress}%`, background: "var(--accent)", borderRadius: 2 }} />
          {isHost && (
            <div style={{ position: "absolute", top: "50%", left: `${progress}%`, transform: "translate(-50%, -50%)", width: 12, height: 12, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-4">
          {isHost ? (
            <button onClick={togglePlay} style={{ background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>
              {isPlaying ? "⏸" : "▶"}
            </button>
          ) : (
            <span style={{ fontSize: 13, opacity: 0.5 }}>👁 Viewing</span>
          )}

          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, minWidth: 90 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Movie name */}
          {movieName && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
              {movieName}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Change file (host only) */}
          {isHost && (
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.2)" }}>
              📂 Change
              <input type="file" accept="video/*" onChange={handleFilePick} style={{ display: "none" }} />
            </label>
          )}

          {/* Volume */}
          <button onClick={toggleMute} style={{ background: "none", border: "none", color: "white", fontSize: 16, cursor: "pointer" }}>
            {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </button>
          <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            style={{ width: 70, accentColor: "var(--accent)", cursor: "pointer" }} />

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} style={{ background: "none", border: "none", color: "white", fontSize: 16, cursor: "pointer" }}>⛶</button>

          {isHost && (
            <span style={{ background: "var(--accent)", color: "#09090f", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>HOST</span>
          )}
        </div>
      </div>
    </div>
  );
}
