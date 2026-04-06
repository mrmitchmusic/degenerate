"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DesktopWindow } from "@/components/DesktopWindow";
import type { GlobalState, SessionOpenResponse, SessionSnapshot } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const SESSION_STORAGE_KEY = "mitch-os-88-session-id";
const CLIENT_STORAGE_KEY = "mitch-os-88-client-id";
let openingSessionPromise: Promise<SessionOpenResponse> | null = null;

type DesktopItem = {
  id: string;
  label: string;
  iconClassName: string;
  x: number;
  y: number;
  passive?: boolean;
  href?: string;
};

const DEFAULT_DESKTOP_ITEMS: DesktopItem[] = [
  { id: "audio", label: "mitch_os_88_master.wav", iconClassName: "icon-audio", x: 1120, y: 48 },
  { id: "readme", label: "Read Me", iconClassName: "icon-readme", x: 1120, y: 140 },
  { id: "visualizer", label: "Visualiser", iconClassName: "icon-visualizer", x: 1120, y: 232 },
  {
    id: "apple-music",
    label: "Follow",
    iconClassName: "icon-apple-music",
    x: 1120,
    y: 324,
    href: "https://music.apple.com/artist/a/370573771?app=music&itscg=10002&itsct=mus_370573771&ct=OQOgWFoHL&at=1010l367Y&ls=1",
  },
  {
    id: "spotify",
    label: "Follow",
    iconClassName: "icon-spotify",
    x: 1120,
    y: 416,
    href: "https://open.spotify.com/artist/2XiGESIh2E2ockoVUG4NGv?si=k3_kuL2YQ0S_ELxVxL2yGQ",
  },
];

const MENU_DEFINITIONS = {
  apple: [
    { label: "TikTok", iconClassName: "icon-social-tiktok", href: "https://www.tiktok.com/@mrmitchmusic" },
    { label: "Instagram", iconClassName: "icon-social-instagram", href: "https://www.instagram.com/milesofmanynames" },
    { label: "YouTube", iconClassName: "icon-social-youtube", href: "https://www.youtube.com/@MrMitch" },
    { label: "X", iconClassName: "icon-social-x", href: "https://x.com/mrmitchmusic" },
  ],
  file: [
    { label: "New Folder", shortcut: "⌘N", action: "new-folder", enabled: true },
    { label: "Open", shortcut: "⌘O", enabled: true },
    { label: "Print", shortcut: "⌘P", enabled: false },
    { type: "separator" },
    { label: "Get Info", enabled: true },
    { label: "Label", enabled: true },
    { label: "Duplicate", shortcut: "⌘D", enabled: true },
    { label: "Make Alias", shortcut: "⌘M", enabled: true },
    { type: "separator" },
    { label: "Find...", shortcut: "⌘F", enabled: true },
    { type: "separator" },
    { label: "Page Setup...", enabled: true },
    { label: "Print Desktop...", enabled: true },
  ],
  edit: [
    { label: "Undo", shortcut: "⌘Z", enabled: false },
    { type: "separator" },
    { label: "Cut", shortcut: "⌘X", enabled: true },
    { label: "Copy", shortcut: "⌘C", enabled: true },
    { label: "Paste", shortcut: "⌘V", enabled: false },
    { label: "Clear", enabled: true },
    { label: "Select All", shortcut: "⌘A", enabled: true },
    { label: "Show Clipboard", enabled: true },
    { type: "separator" },
    { label: "Preferences...", enabled: true },
  ],
  view: [
    { label: "as Icons", enabled: true, checked: true },
    { label: "as Buttons", enabled: true },
    { label: "as List", enabled: false },
    { type: "separator" },
    { label: "Clean Up", enabled: true },
    { label: "Arrange", enabled: true, submenu: true },
    { label: "Reset Column Positions", enabled: false },
    { type: "separator" },
    { label: "View Options...", enabled: true },
  ],
  special: [
    { label: "Empty Trash...", enabled: false },
    { label: "Eject", shortcut: "⌘E", enabled: false },
    { label: "Erase Disk...", enabled: false },
    { type: "separator" },
    { label: "Sleep", enabled: true },
    { label: "Restart", enabled: true },
    { label: "Shut Down", enabled: true },
  ],
  help: [{ label: "Read Me", action: "readme", enabled: true }],
} as const;

type MenuKey = keyof typeof MENU_DEFINITIONS;

const readMeText = `Nothing lasts forever. A fact that we're constantly reminded about in many aspects of our lives, but in the digital world it presents itself in a different way. People lose interest, they forget, they move on to 'better' things, but the items they have forgotten are still there, in their same form.

Is the fragility of the physical form something that gives it value?

If a song degrades every time it gets played, is it more valuable on the first play or the last?

This is an experiment in digital degradation.
There is one track, one listener at a time.
Every time the song gets played, it degrades. No single listener hears the same version of the track.

When the sound becomes unreadable, too quiet, or too broken to function, the file is declared dead and playback stops.

Please enjoy the song while it is here, in whatever form you manage to hear it.

- Miles (Mr. Mitch)`;

const FOLDER_NAME_WORDS = [
  "Mr.",
  "Mitch",
  "is",
  "the",
  "greatest",
  "producer",
  "to",
  "ever",
  "grace",
  "this",
  "earth",
  "one",
  "day",
  "his",
  "genius",
  "will",
  "be",
  "realised",
  "and",
  "World",
  "Peace",
  "will",
  "be",
  "granted",
  "by",
  "the",
  "universe",
  "as",
  "a",
  "sign",
  "of",
  "respect.",
];

function formatClock(now: Date) {
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSeconds(value: number) {
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getClientId() {
  const existing = window.localStorage.getItem(CLIENT_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const next = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_STORAGE_KEY, next);
  return next;
}

export default function Home() {
  const [clock, setClock] = useState("--:--");
  const [state, setState] = useState<GlobalState | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [hasEnteredSystem, setHasEnteredSystem] = useState(false);
  const [booting, setBooting] = useState(false);
  const [readMeOpen, setReadMeOpen] = useState(true);
  const [visualizerOpen, setVisualizerOpen] = useState(false);
  const [frontWindow, setFrontWindow] = useState<"player" | "readme" | "visualizer">("player");
  const [isPlaying, setIsPlaying] = useState(false);
  const [pauseElapsed, setPauseElapsed] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [audioDebug, setAudioDebug] = useState("idle");
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [desktopItems, setDesktopItems] = useState<DesktopItem[]>(DEFAULT_DESKTOP_ITEMS);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerAvailableRef = useRef(false);
  const visualizerTrailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const listenRef = useRef(0);
  const pauseRef = useRef(0);
  const sessionRef = useRef<SessionSnapshot | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const autoplayAttemptedSessionRef = useRef<string | null>(null);
  const desktopDragRef = useRef<{ id: DesktopItem["id"]; offsetX: number; offsetY: number } | null>(null);
  const isPlayingRef = useRef(false);
  const activeSessionId = session?.session_id ?? null;

  function resetPlayerState() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setIsPlaying(false);
    setAudioReady(false);
    setPauseElapsed(0);
    setPlaybackPosition(0);
    setPlaybackError(null);
    setAudioDebug("idle");
    listenRef.current = 0;
    pauseRef.current = 0;
    pendingSeekRef.current = null;
    autoplayAttemptedSessionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
  }

  async function openFreshSession() {
    if (!openingSessionPromise) {
      openingSessionPromise = fetch(`${API_URL}/session/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: getClientId() }),
      })
        .then((response) => response.json() as Promise<SessionOpenResponse>)
        .finally(() => {
          openingSessionPromise = null;
        });
    }

    const payload = await openingSessionPromise;
    window.localStorage.setItem(SESSION_STORAGE_KEY, payload.session.session_id);
    setSession(payload.session);
    setState(payload.state);
    listenRef.current = payload.session.listened_seconds;
    pauseRef.current = payload.session.paused_seconds;
    setPauseElapsed(payload.session.paused_seconds);
    setPlaybackPosition(payload.session.listened_seconds);
    setAudioReady(false);
    setPlaybackError(null);
    setAudioDebug("idle");
    autoplayAttemptedSessionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    return payload.session;
  }

  useEffect(() => {
    sessionRef.current = session;
    sessionIdRef.current = session?.session_id ?? null;
  }, [session]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    setDesktopItems((current) =>
      current.map((item) =>
        item.id === "audio" ? { ...item, label: state?.filename ?? "mitch_os_88_master.wav" } : item,
      ),
    );
  }, [state?.filename]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!audioContextRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      try {
        const context = new AudioContextCtor();
        const analyser = context.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.78;
        const source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);

        audioContextRef.current = context;
        analyserRef.current = analyser;
        sourceNodeRef.current = source;
        visualizerAvailableRef.current = true;
      } catch (error) {
        console.error("Visualizer audio hookup failed", error);
        visualizerAvailableRef.current = false;
      }
    }

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !visualizerOpen || !hasEnteredSystem) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const trailCanvas =
      visualizerTrailCanvasRef.current ??
      (() => {
        const next = document.createElement("canvas");
        next.width = canvas.width;
        next.height = canvas.height;
        visualizerTrailCanvasRef.current = next;
        return next;
      })();
    const trailContext = trailCanvas.getContext("2d");
    if (!trailContext) {
      return;
    }
    trailContext.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    context.clearRect(0, 0, canvas.width, canvas.height);

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const time = performance.now() * 0.001;
      const waveform = new Uint8Array(analyser?.fftSize ?? 64);

      if (visualizerAvailableRef.current && analyser && isPlayingRef.current && audioReady) {
        analyser.getByteFrequencyData(buffer);
        analyser.getByteTimeDomainData(waveform);
      } else {
        buffer.fill(0);
        waveform.fill(128);
      }

      const bass = ((buffer[1] ?? 0) + (buffer[2] ?? 0) + (buffer[3] ?? 0)) / (255 * 3);
      const mid = ((buffer[8] ?? 0) + (buffer[10] ?? 0) + (buffer[12] ?? 0)) / (255 * 3);
      const treble = ((buffer[20] ?? 0) + (buffer[24] ?? 0) + (buffer[28] ?? 0)) / (255 * 3);
      const centerX = width / 2;
      const centerY = height / 2;
      const energy = Math.min(1, bass * 0.5 + mid * 0.3 + treble * 0.2);
      const hueShift = (time * 18) % 360;

      trailContext.save();
      trailContext.globalCompositeOperation = "source-over";
      trailContext.fillStyle = `rgba(3, 2, 10, ${isPlayingRef.current ? 0.07 : 0.18})`;
      trailContext.fillRect(0, 0, width, height);

      trailContext.translate(centerX, centerY);
      trailContext.rotate(0.003 + bass * 0.025);
      const zoom = 1.006 + energy * 0.018;
      trailContext.scale(zoom, zoom);
      trailContext.translate(-centerX, -centerY);
      trailContext.drawImage(canvas, 0, 0, width, height);
      trailContext.restore();

      const background = trailContext.createRadialGradient(
        centerX + Math.sin(time * 0.35) * (18 + bass * 30),
        centerY + Math.cos(time * 0.48) * (14 + mid * 24),
        6,
        centerX,
        centerY,
        width * 0.72,
      );
      background.addColorStop(0, `hsla(${(hueShift + 260) % 360}, 72%, 14%, 0.18)`);
      background.addColorStop(0.4, `hsla(${(hueShift + 140) % 360}, 78%, 20%, 0.08)`);
      background.addColorStop(1, `hsla(${(hueShift + 300) % 360}, 65%, 5%, 0.02)`);
      trailContext.fillStyle = background;
      trailContext.fillRect(0, 0, width, height);

      for (let tunnel = 0; tunnel < 18; tunnel += 1) {
        const progress = tunnel / 18;
        const radius = 22 + progress * 132 + bass * 26;
        const hue = (hueShift + 102 + progress * 34 + Math.sin(time * 0.55 + tunnel) * 16) % 360;
        const alpha = 0.06 + progress * 0.05;
        trailContext.beginPath();
        for (let step = 0; step <= 180; step += 1) {
          const angle = (step / 180) * Math.PI * 2;
          const waveIndex = Math.floor((step / 180) * waveform.length) % waveform.length;
          const waveValue = ((waveform[waveIndex] ?? 128) - 128) / 128;
          const spiral = angle + time * (0.22 + progress * 0.18);
          const distortion =
            Math.sin(spiral * 3 + time * 0.8 + tunnel * 0.3) * (10 + progress * 18 + mid * 22) +
            Math.cos(spiral * 7 - time * 0.4) * (6 + treble * 20) +
            waveValue * (18 + progress * 24);
          const ellipse = 0.55 + progress * 0.65;
          const x = centerX + Math.cos(spiral) * (radius + distortion);
          const y = centerY + Math.sin(spiral) * (radius * ellipse + distortion * 0.82);
          if (step === 0) {
            trailContext.moveTo(x, y);
          } else {
            trailContext.lineTo(x, y);
          }
        }
        trailContext.strokeStyle = `hsla(${hue}, 96%, ${42 + progress * 25}%, ${alpha})`;
        trailContext.lineWidth = 1 + progress * 3.4;
        trailContext.stroke();
      }

      trailContext.globalCompositeOperation = "screen";
      for (let ribbon = 0; ribbon < 9; ribbon += 1) {
        trailContext.beginPath();
        for (let x = -12; x <= width + 12; x += 3) {
          const waveIndex = Math.floor(((x + width) / (width + 24)) * waveform.length) % waveform.length;
          const waveValue = ((waveform[waveIndex] ?? 128) - 128) / 128;
          const drift = Math.sin(time * (0.7 + ribbon * 0.08) + x * 0.012 + ribbon) * (20 + bass * 40);
          const y =
            centerY +
            Math.sin((x / width) * Math.PI * (1.5 + ribbon * 0.35) + time * (1 + ribbon * 0.12)) * (24 + ribbon * 7) +
            waveValue * (30 + ribbon * 4) +
            drift;
          if (x <= -12) {
            trailContext.moveTo(x, y);
          } else {
            trailContext.lineTo(x, y);
          }
        }
        trailContext.strokeStyle =
          ribbon % 3 === 0
            ? `hsla(${(hueShift + 120) % 360}, 100%, 64%, ${0.22 + ribbon * 0.03})`
            : ribbon % 3 === 1
              ? `hsla(${(hueShift + 340) % 360}, 100%, 62%, ${0.14 + ribbon * 0.025})`
              : `hsla(${(hueShift + 230) % 360}, 100%, 68%, ${0.16 + ribbon * 0.025})`;
        trailContext.lineWidth = 1.6 + ribbon * 0.45;
        trailContext.stroke();
      }

      for (let spoke = 0; spoke < 36; spoke += 1) {
        const angle = (spoke / 36) * Math.PI * 2 + time * (0.08 + treble * 0.3);
        const waveIndex = spoke % waveform.length;
        const waveValue = ((waveform[waveIndex] ?? 128) - 128) / 128;
        const inner = 6 + spoke * 0.6;
        const outer = 80 + bass * 120 + (buffer[spoke % buffer.length] ?? 0) * 0.55;
        const bend = Math.sin(time * 1.5 + spoke * 0.6) * (22 + mid * 26) + waveValue * 30;
        const x1 = centerX + Math.cos(angle) * inner;
        const y1 = centerY + Math.sin(angle) * inner;
        const cx = centerX + Math.cos(angle + 0.22) * (outer * 0.55) + bend;
        const cy = centerY + Math.sin(angle + 0.22) * (outer * 0.55) - bend * 0.7;
        const x2 = centerX + Math.cos(angle + 0.05) * outer;
        const y2 = centerY + Math.sin(angle + 0.05) * outer;
        trailContext.strokeStyle =
          spoke % 2 === 0
            ? `hsla(${(hueShift + 118) % 360}, 100%, 60%, ${0.08 + treble * 0.35})`
            : `hsla(${(hueShift + 350) % 360}, 100%, 58%, ${0.05 + mid * 0.2})`;
        trailContext.lineWidth = 1 + (spoke % 4) * 0.9;
        trailContext.beginPath();
        trailContext.moveTo(x1, y1);
        trailContext.quadraticCurveTo(cx, cy, x2, y2);
        trailContext.stroke();
      }

      trailContext.globalCompositeOperation = "source-over";
      const coreGlow = trailContext.createRadialGradient(centerX, centerY, 1, centerX, centerY, 20 + bass * 30);
      coreGlow.addColorStop(0, `hsla(${(hueShift + 8) % 360}, 100%, 68%, 0.98)`);
      coreGlow.addColorStop(0.2, `hsla(${(hueShift + 24) % 360}, 100%, 56%, 0.88)`);
      coreGlow.addColorStop(0.45, `hsla(${(hueShift + 320) % 360}, 100%, 48%, 0.35)`);
      coreGlow.addColorStop(1, `hsla(${(hueShift + 8) % 360}, 100%, 60%, 0)`);
      trailContext.fillStyle = coreGlow;
      trailContext.beginPath();
      trailContext.arc(centerX, centerY, 20 + bass * 30, 0, Math.PI * 2);
      trailContext.fill();

      context.clearRect(0, 0, width, height);
      context.drawImage(trailCanvas, 0, 0, width, height);
      context.strokeStyle = `hsla(${(hueShift + 118) % 360}, 100%, 62%, 0.92)`;
      context.lineWidth = 2;
      context.strokeRect(1, 1, width - 2, height - 2);
      context.strokeStyle = `hsla(${(hueShift + 350) % 360}, 78%, 28%, 0.94)`;
      context.lineWidth = 3;
      context.strokeRect(4, 4, width - 8, height - 8);

      if (!visualizerAvailableRef.current) {
        context.fillStyle = "#d7d7d7";
        context.font = '700 12px Charcoal, Geneva, sans-serif';
        context.fillText("Visualizer unavailable in this browser", 12, height - 14);
      }

      animationFrameRef.current = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [audioReady, hasEnteredSystem, visualizerOpen]);

  useEffect(() => {
    function closeMenu() {
      setOpenMenu(null);
    }

    function handleMove(event: MouseEvent) {
      if (!desktopDragRef.current) {
        return;
      }

      const iconWidth = 88;
      const iconHeight = 88;
      const nextX = event.clientX - desktopDragRef.current.offsetX;
      const nextY = event.clientY - desktopDragRef.current.offsetY;

      setDesktopItems((current) =>
        current.map((item) =>
          item.id === desktopDragRef.current?.id
            ? {
                ...item,
                x: Math.min(Math.max(18, nextX), window.innerWidth - iconWidth - 18),
                y: Math.min(Math.max(38, nextY), window.innerHeight - iconHeight - 18),
              }
            : item,
        ),
      );
    }

    function handleUp() {
      desktopDragRef.current = null;
    }

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/state`)
      .then((response) => response.json() as Promise<GlobalState>)
      .then(setState)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!hasEnteredSystem) {
      resetPlayerState();
      return;
    }

    let cancelled = false;

    async function loadSession() {
      const nextSession = await openFreshSession();
      if (cancelled) {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        if (sessionRef.current?.session_id === nextSession.session_id) {
          setSession(null);
        }
      }
    }

    loadSession().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [hasEnteredSystem]);

  useEffect(() => {
    if (!hasEnteredSystem || !activeSessionId) {
      return;
    }

    const poll = window.setInterval(async () => {
      try {
        const [sessionResponse, stateResponse] = await Promise.all([
          fetch(`${API_URL}/session/${activeSessionId}`),
          fetch(`${API_URL}/state`),
        ]);
        const statePayload: GlobalState = await stateResponse.json();
        if (!sessionResponse.ok) {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
          const nextSession = await openFreshSession();
          setSession(nextSession);
          setState(statePayload);
          return;
        }

        const sessionPayload: SessionSnapshot = await sessionResponse.json();
        setSession(sessionPayload);
        setState(statePayload);
        listenRef.current = sessionPayload.listened_seconds;
        setPlaybackPosition((current) =>
          isPlayingRef.current ? Math.max(current, sessionPayload.listened_seconds) : sessionPayload.listened_seconds,
        );
        if (sessionPayload.status === "ended" || statePayload.status === "dead") {
          setIsPlaying(false);
          audioRef.current?.pause();
        }
      } catch (error) {
        console.error(error);
      }
    }, 2000);

    return () => window.clearInterval(poll);
  }, [activeSessionId, hasEnteredSystem]);

  useEffect(() => {
    if (!hasEnteredSystem || !session?.is_active || !activeSessionId) {
      return;
    }

    const heartbeat = window.setInterval(async () => {
      const current = audioRef.current;
      const listenedSeconds = current ? Math.max(listenRef.current, current.currentTime) : listenRef.current;
      listenRef.current = listenedSeconds;
      try {
        const response = await fetch(`${API_URL}/session/${activeSessionId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listened_seconds: listenedSeconds,
            paused_seconds: pauseRef.current,
            is_paused: current ? current.paused : true,
          }),
        });
        const payload: SessionSnapshot = await response.json();
        setSession(payload);
      } catch (error) {
        console.error(error);
      }
    }, 1000);

    return () => window.clearInterval(heartbeat);
  }, [activeSessionId, hasEnteredSystem, session?.is_active]);

  useEffect(() => {
    if (!hasEnteredSystem || !session?.is_active || !activeSessionId || isPlaying || state?.status === "dead") {
      return;
    }
    if (autoplayAttemptedSessionRef.current === activeSessionId) {
      return;
    }

    autoplayAttemptedSessionRef.current = activeSessionId;
    void handlePlay(true);
  }, [activeSessionId, hasEnteredSystem, isPlaying, session?.is_active, state?.status]);

  useEffect(() => {
    if (!hasEnteredSystem || !session?.is_active) {
      return;
    }
    const pauseTimer = window.setInterval(() => {
      const current = audioRef.current;
      if (current?.paused && current.src && session?.is_active) {
        pauseRef.current += 1;
        setPauseElapsed(pauseRef.current);
      }
    }, 1000);
    return () => window.clearInterval(pauseTimer);
  }, [hasEnteredSystem, session?.is_active]);

  useEffect(() => {
    if (pauseRef.current <= 30 || !activeSessionId || !session) {
      return;
    }

    void endSession("pause_limit");
  }, [pauseElapsed, activeSessionId, session]);

  useEffect(() => {
    const handleUnload = () => {
      const currentSession = sessionRef.current;
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || !currentSession || currentSession.status === "ended") {
        return;
      }
      void fetch(`${API_URL}/session/${currentSessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listened_seconds: listenRef.current,
          paused_seconds: pauseRef.current,
          reason: "disconnect",
        }),
        keepalive: true,
      });
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  const integrity = useMemo(() => Math.round(state?.integrity_percent ?? 100), [state?.integrity_percent]);
  const progressPercent = useMemo(() => {
    if (!state?.duration_seconds) {
      return 0;
    }
    return Math.min(100, (playbackPosition / state.duration_seconds) * 100);
  }, [playbackPosition, state?.duration_seconds]);

  async function endSession(reason: "completed" | "disconnect" | "pause_limit" | "manual" | "dead") {
    if (!activeSessionId) {
      return;
    }
    const response = await fetch(`${API_URL}/session/${activeSessionId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listened_seconds: listenRef.current,
        paused_seconds: pauseRef.current,
        reason,
      }),
    });
    const payload: SessionSnapshot = await response.json();
    setSession(payload);
    const stateResponse = await fetch(`${API_URL}/state`);
    const statePayload: GlobalState = await stateResponse.json();
    setState(statePayload);
    resetPlayerState();
    setHasEnteredSystem(false);
    setBooting(false);
  }

  async function handlePlay(isAutoplay = false) {
    let currentSession = session;

    if (state?.status === "dead") {
      setPlaybackError("The canonical WAV is dead.");
      setAudioDebug("blocked: dead");
      return;
    }

    if (!currentSession || currentSession.status === "ended" || !currentSession.is_active) {
      currentSession = await openFreshSession();
    }

    if (!currentSession.is_active) {
      setPlaybackError("Waiting for active listener slot.");
      setAudioDebug(`blocked: ${currentSession.status} queue=${currentSession.queue_position}`);
      return;
    }

    if (!audioRef.current) {
      setPlaybackError("Audio device unavailable.");
      setAudioDebug("blocked: missing audio element");
      return;
    }
    const nextSrc = `${API_URL}/audio/current?session=${currentSession.session_id}`;
    const currentAudio = audioRef.current;
    const currentSrcUrl = currentAudio.currentSrc || currentAudio.src;
    const currentSrcSession = currentSrcUrl ? new URL(currentSrcUrl).searchParams.get("session") : null;
    const canResumeCurrentSource =
      currentSrcSession === currentSession.session_id &&
      currentAudio.getAttribute("src") &&
      !currentAudio.ended;

    try {
      currentAudio.muted = false;
      currentAudio.defaultMuted = false;
      currentAudio.volume = 1;
      currentAudio.playbackRate = 1;
      setPlaybackError(null);
      await audioContextRef.current?.resume();

      if (!canResumeCurrentSource) {
        currentAudio.pause();
        currentAudio.src = nextSrc;
        currentAudio.load();
        pendingSeekRef.current = listenRef.current;
        setAudioDebug(`src set | muted=${currentAudio.muted} volume=${currentAudio.volume.toFixed(2)}`);
      } else if (Math.abs(currentAudio.currentTime - listenRef.current) > 0.5) {
        currentAudio.currentTime = listenRef.current;
        setAudioDebug(`resume seek ${listenRef.current.toFixed(2)}`);
      }

      await currentAudio.play();
      setIsPlaying(true);
      setAudioDebug(`play() resolved | paused=${currentAudio.paused} readyState=${currentAudio.readyState}`);
    } catch (error) {
      console.error("Playback failed", error);
      setIsPlaying(false);
      setPlaybackError(
        isAutoplay ? "Autoplay blocked. Press Play to begin." : error instanceof Error ? error.message : "Unknown playback error",
      );
      setAudioDebug(isAutoplay ? "autoplay blocked" : "play() failed");
    }
  }

  function handlePause() {
    audioRef.current?.pause();
    setIsPlaying(false);
  }

  async function handleEnterSystem() {
    setBooting(true);
    setPlaybackError(null);
    setAudioDebug("booting");
    setTimeout(() => {
      setHasEnteredSystem(true);
      setBooting(false);
    }, 900);
  }

  function handleDesktopItemOpen(item: DesktopItem) {
    if (item.href) {
      window.open(item.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.id === "audio") {
      setFrontWindow("player");
      return;
    }
    if (item.id === "visualizer") {
      setVisualizerOpen(true);
      setFrontWindow("visualizer");
      return;
    }
    if (item.id === "readme") {
      setReadMeOpen(true);
      setFrontWindow("readme");
    }
  }

  function createNewFolder() {
    setDesktopItems((current) => {
      const folderCount = current.filter((item) => item.iconClassName === "icon-folder").length + 1;
      const pairIndex = ((folderCount - 1) * 2) % FOLDER_NAME_WORDS.length;
      const nextLabel = `${FOLDER_NAME_WORDS[pairIndex]} ${FOLDER_NAME_WORDS[(pairIndex + 1) % FOLDER_NAME_WORDS.length]}`;
      const iconWidth = 88;
      const iconHeight = 88;
      const startX = 20;
      const startY = 48;
      const stepX = 96;
      const stepY = 92;
      const maxX = window.innerWidth - iconWidth - 18;
      const maxY = window.innerHeight - iconHeight - 18;
      const columns = Math.max(1, Math.floor((maxX - startX) / stepX) + 1);
      const rows = Math.max(1, Math.floor((maxY - startY) / stepY) + 1);

      const occupied = new Set(
        current.map((item) => {
          const column = Math.round((item.x - startX) / stepX);
          const row = Math.round((item.y - startY) / stepY);
          return `${column}:${row}`;
        }),
      );

      let chosenColumn = 0;
      let chosenRow = 0;
      let foundSlot = false;

      for (let column = columns - 1; column >= 0 && !foundSlot; column -= 1) {
        for (let row = 0; row < rows; row += 1) {
          if (!occupied.has(`${column}:${row}`)) {
            chosenColumn = column;
            chosenRow = row;
            foundSlot = true;
            break;
          }
        }
      }

      if (!foundSlot) {
        chosenColumn = columns - 1;
        chosenRow = rows - 1;
      }

      return [
        ...current,
        {
          id: `folder-${crypto.randomUUID()}`,
          label: nextLabel,
          iconClassName: "icon-folder",
          x: Math.min(startX + chosenColumn * stepX, maxX),
          y: Math.min(startY + chosenRow * stepY, maxY),
        },
      ];
    });
  }

  function handleMenuAction(action?: string) {
    if (action === "new-folder") {
      createNewFolder();
      return;
    }
    if (action === "readme") {
      setReadMeOpen(true);
      setFrontWindow("readme");
    }
  }

  return (
    <main className="desktop">
      <audio
        ref={audioRef}
        preload="auto"
        crossOrigin="anonymous"
        muted={false}
        onLoadedMetadata={(event) => {
          setAudioReady(true);
          setAudioDebug(
            `metadata | readyState=${event.currentTarget.readyState} networkState=${event.currentTarget.networkState}`,
          );
        }}
        onLoadedData={(event) => {
          setAudioReady(true);
          setAudioDebug(
            `data | readyState=${event.currentTarget.readyState} networkState=${event.currentTarget.networkState}`,
          );
          if (pendingSeekRef.current !== null) {
            event.currentTarget.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
          }
        }}
        onTimeUpdate={(event) => {
          listenRef.current = event.currentTarget.currentTime;
          setPlaybackPosition(event.currentTarget.currentTime);
          setAudioDebug(
            `time=${event.currentTarget.currentTime.toFixed(2)} paused=${event.currentTarget.paused} muted=${event.currentTarget.muted} volume=${event.currentTarget.volume.toFixed(2)}`,
          );
        }}
        onPlay={() => {
          setPlaybackError(null);
          setIsPlaying(true);
          setAudioDebug("playing");
        }}
        onPause={() => {
          setIsPlaying(false);
          setAudioDebug("paused");
        }}
        onError={() => {
          const audio = audioRef.current;
          const mediaError = audio?.error;
          if (!mediaError) {
            setPlaybackError("Audio playback failed.");
            setAudioDebug("error without media error");
            return;
          }

          const codeMap: Record<number, string> = {
            1: "Playback aborted.",
            2: "Network error while loading audio.",
            3: "Audio decoding failed.",
            4: "Audio format not supported by the browser.",
          };
          setPlaybackError(codeMap[mediaError.code] ?? "Unknown audio error.");
          setAudioDebug(`media error ${mediaError.code}`);
        }}
        onEnded={() => {
          void endSession("completed");
        }}
        onSeeking={(event) => {
          const audio = event.currentTarget;
          if (Math.abs(audio.currentTime - listenRef.current) > 1) {
            audio.currentTime = listenRef.current;
          }
        }}
        onRateChange={(event) => {
          event.currentTarget.playbackRate = 1;
        }}
      />

      <header className="menu-bar">
        <div className="menu-left">
          {(["apple", "file", "edit", "view", "special", "help"] as const).map((menuKey) => (
            <div
              key={menuKey}
              className="menu-group"
              onMouseEnter={() => setOpenMenu(menuKey)}
            >
              <button
                type="button"
                className={`${
                  menuKey === "apple" ? "apple-chip menu-trigger" : "menu-item"
                } ${openMenu === menuKey ? "menu-open" : ""}`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenu((current) => (current === menuKey ? null : menuKey));
                }}
              >
                {menuKey === "apple" ? <span className="mitch-menu-logo" aria-hidden="true" /> : menuKey[0].toUpperCase() + menuKey.slice(1)}
              </button>
              {openMenu === menuKey && (
                <div
                  className={`menu-dropdown ${menuKey === "apple" ? "apple-dropdown" : ""}`}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {MENU_DEFINITIONS[menuKey].map((item, index) =>
                    "type" in item ? (
                      <div key={`${menuKey}-separator-${index}`} className="menu-separator" />
                    ) : menuKey === "apple" ? (
                      <a
                        key={`${menuKey}-${item.label}`}
                        className="menu-dropdown-item menu-social-item"
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className={`${item.iconClassName} menu-social-icon`} aria-hidden="true" />
                        <span>{item.label}</span>
                      </a>
                    ) : (
                      <button
                        key={`${menuKey}-${item.label}`}
                        type="button"
                        className={`menu-dropdown-item ${item.enabled === false ? "menu-item-disabled" : ""}`}
                        disabled={item.enabled === false}
                        onClick={() => {
                          setOpenMenu(null);
                          handleMenuAction(item.action);
                        }}
                      >
                        <span className="menu-item-main">
                          <span className="menu-check">{item.checked ? "✓" : ""}</span>
                          <span>{item.label}</span>
                        </span>
                        <span className="menu-item-meta">
                          {item.submenu ? "▶" : item.shortcut ?? ""}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="menu-right">
          <span>{clock}</span>
        </div>
      </header>

      <aside className="desktop-icons">
        {desktopItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`desktop-icon ${item.passive ? "passive-icon" : ""}`}
            style={{ left: item.x, top: item.y }}
            onDoubleClick={() => handleDesktopItemOpen(item)}
            onClick={() => {
              if (!item.passive) {
                handleDesktopItemOpen(item);
              }
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
              desktopDragRef.current = {
                id: item.id,
                offsetX: event.clientX - item.x,
                offsetY: event.clientY - item.y,
              };
            }}
          >
            <span className={`${item.iconClassName} platinum-icon`} />
            <span>{item.label}</span>
          </button>
        ))}
      </aside>

      {hasEnteredSystem && (
      <DesktopWindow
        title="Song Player"
        initialPosition={{ x: 160, y: 80 }}
        width={450}
        height={278}
        zIndex={frontWindow === "player" ? 20 : 10}
        onFocus={() => setFrontWindow("player")}
        closable={false}
      >
        <div className="player-layout">
          <div className="player-header">
            <div className="player-logo" aria-hidden="true" />
            <div className="track-title">{state?.filename ?? "Loading..."}</div>
          </div>
          <div className="button-row">
            <button
              type="button"
              className={`system-button ${isPlaying ? "pressed" : ""}`}
              onClick={() => void handlePlay()}
              disabled={!session?.is_active || state?.status === "dead"}
            >
              Play
            </button>
            <button
              type="button"
              className={`system-button ${!isPlaying && audioReady ? "pressed" : ""}`}
              onClick={handlePause}
              disabled={!session?.is_active || state?.status === "dead"}
            >
              Pause
            </button>
          </div>

          <div className="player-block">
            <div>Progress</div>
            <div className="meter-frame progress-frame">
              <div className="meter-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div>{formatSeconds(playbackPosition)} / {formatSeconds(state?.duration_seconds ?? 0)}</div>
          </div>

          <div className="player-block">
            <div>Integrity:</div>
            <div className="integrity-row">
              <div className="meter-frame integrity-frame">
                <div className="meter-fill" style={{ width: `${integrity}%` }} />
              </div>
              <span>{integrity}%</span>
            </div>
          </div>

          <div className="player-block">
            <div>Pause Remaining: {Math.max(0, 30 - Math.floor(pauseElapsed))}s</div>
            <div>Status: {state?.status === "dead" ? "File Dead" : session?.is_active ? "Active" : "Waiting"}</div>
          </div>
        </div>
      </DesktopWindow>
      )}

      {hasEnteredSystem && visualizerOpen && (
        <DesktopWindow
          title="Visualiser"
          initialPosition={{ x: 625, y: 82 }}
          width={338}
          height={240}
          zIndex={frontWindow === "visualizer" ? 20 : 10}
          onFocus={() => setFrontWindow("visualizer")}
          closable
          onClose={() => setVisualizerOpen(false)}
        >
          <div className="visualizer-layout">
            <div className="visualizer-caption">{isPlaying ? "Live Audio Monitor" : "Standing By"}</div>
            <canvas
              ref={visualizerCanvasRef}
              className="visualizer-canvas"
              width={300}
              height={150}
            />
            <div className="visualizer-meta">
              <span>{state?.filename ?? "No file"}</span>
              <span>{isPlaying ? "Reacting to playback" : "Press Play to begin"}</span>
            </div>
          </div>
        </DesktopWindow>
      )}

      {hasEnteredSystem && readMeOpen && (
        <DesktopWindow
          title="Read Me"
          initialPosition={{ x: 520, y: 108 }}
          width={560}
          height={500}
          zIndex={frontWindow === "readme" ? 20 : 10}
          onFocus={() => setFrontWindow("readme")}
          closable
          onClose={() => setReadMeOpen(false)}
        >
          <pre className="readme-text">{readMeText}</pre>
        </DesktopWindow>
      )}

      {hasEnteredSystem && session && !session.is_active && session.status !== "ended" && state?.status !== "dead" && (
        <div className="queue-overlay">
          <div className="queue-window">
            <div className="window-title-bar static-title">
              <button type="button" className="close-box" aria-hidden="true" disabled />
              <span>System Busy</span>
            </div>
            <div className="queue-body">
              <p>Another user is currently accessing this file.</p>
              <p>Queue Position: {session.queue_position}</p>
              <p>Estimated Wait: {formatSeconds(session.estimated_wait_seconds)}</p>
            </div>
          </div>
        </div>
      )}

      {state?.status === "dead" && (
        <div className="queue-overlay">
          <div className="queue-window dead-window">
            <div className="window-title-bar static-title">
              <button type="button" className="close-box" aria-hidden="true" disabled />
              <span>File Dead</span>
            </div>
            <div className="queue-body">
              <p>The canonical WAV can no longer be used.</p>
              <p>This system has no recovery procedure.</p>
              <p>Total Damage: {state.total_damage.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {!hasEnteredSystem && state?.status !== "dead" && (
        <div className="boot-overlay">
          <div className="boot-window">
            <div className="boot-inner">
              <div className="boot-logo-frame">
                <div className="boot-logo" aria-hidden="true" />
                <div className="boot-wordmark" aria-label="MitchOS 88">
                  <span className="boot-wordmark-mitch">Mitch</span>
                  <span className="boot-wordmark-os">OS</span>
                  <span className="boot-wordmark-version">88</span>
                </div>
              </div>
              <div className="boot-status">{booting ? "Starting Up..." : "Click to enter."}</div>
              <div className="boot-progress">
                <div className="boot-progress-track">
                  <div className="boot-progress-fill" style={{ width: booting ? "62%" : "28%" }} />
                </div>
              </div>
              <button type="button" className="system-button boot-button" onClick={() => void handleEnterSystem()} disabled={booting}>
                {booting ? "Starting..." : "Enter Mitch OS 88"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
