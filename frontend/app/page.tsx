"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DesktopWindow, WindowTitleBar } from "@/components/DesktopWindow";
import type { GlobalState, SessionOpenResponse, SessionSnapshot } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const SESSION_STORAGE_KEY = "mitch-os-88-session-id";
const BROWSER_SESSION_STORAGE_KEY = "mitch-os-88-browser-session-id";
const LEGACY_CLIENT_STORAGE_KEY = "mitch-os-88-client-id";
const TAB_STORAGE_KEY = "mitch-os-88-tab-id";
const ACTIVE_CONTROLLER_TAB_STORAGE_KEY = "active_controller_tab";
const LEGACY_ACTIVE_TAB_STORAGE_KEY = "mitch-os-88-active-tab";
let openingSessionPromise: Promise<SessionOpenResponse> | null = null;
const DESKTOP_WIDTH = 1280;
const DESKTOP_HEIGHT = 800;
const DESKTOP_MENU_HEIGHT = 22;
const ICON_WIDTH = 88;
const ICON_HEIGHT = 88;

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
type AppleMenuItem = (typeof MENU_DEFINITIONS.apple)[number];
type StandardMenuItem = {
  label: string;
  enabled?: boolean;
  action?: string;
  checked?: boolean;
  submenu?: boolean;
  shortcut?: string;
};

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
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getBrowserSessionId() {
  const existing =
    window.localStorage.getItem(BROWSER_SESSION_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_CLIENT_STORAGE_KEY);
  if (existing) {
    window.localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, existing);
    return existing;
  }
  const next = crypto.randomUUID();
  window.localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, next);
  return next;
}

function getBrowserSessionHeaders() {
  return {
    "X-Browser-Session-Id": getBrowserSessionId(),
  };
}

function getTabId() {
  const existing = window.sessionStorage.getItem(TAB_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(TAB_STORAGE_KEY, next);
  return next;
}

function getStoredActiveControllerTab() {
  return (
    window.localStorage.getItem(ACTIVE_CONTROLLER_TAB_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_ACTIVE_TAB_STORAGE_KEY)
  );
}

export default function Home() {
  const [desktopScale, setDesktopScale] = useState(1);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
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
  const [tabId, setTabId] = useState<string | null>(null);
  const [activePlaybackTabId, setActivePlaybackTabId] = useState<string | null>(null);
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
  const visualizerDebugLogAtRef = useRef(0);
  const listenRef = useRef(0);
  const pauseRef = useRef(0);
  const sessionRef = useRef<SessionSnapshot | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const autoplayAttemptedSessionRef = useRef<string | null>(null);
  const desktopDragRef = useRef<{ pointerId: number; id: DesktopItem["id"]; offsetX: number; offsetY: number } | null>(null);
  const isPlayingRef = useRef(false);
  const desktopScaleRef = useRef(1);
  const activeSessionId = session?.session_id ?? null;
  const sameSessionActiveInAnotherTab = Boolean(session?.is_active && tabId && activePlaybackTabId && activePlaybackTabId !== tabId);
  const controlsDisabled = Boolean(!session?.is_active || state?.status === "dead" || sameSessionActiveInAnotherTab);

  function claimActiveTab() {
    if (!tabId) {
      return;
    }
    window.localStorage.setItem(ACTIVE_CONTROLLER_TAB_STORAGE_KEY, tabId);
    window.localStorage.removeItem(LEGACY_ACTIVE_TAB_STORAGE_KEY);
    setActivePlaybackTabId(tabId);
  }

  function releaseActiveTab() {
    if (!tabId) {
      return;
    }
    if (getStoredActiveControllerTab() === tabId) {
      window.localStorage.removeItem(ACTIVE_CONTROLLER_TAB_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_ACTIVE_TAB_STORAGE_KEY);
      setActivePlaybackTabId(null);
    }
  }

  async function ensureVisualizerAudioGraph() {
    const audio = audioRef.current;
    if (!audio) {
      return false;
    }

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      visualizerAvailableRef.current = false;
      return false;
    }

    try {
      if (!audioContextRef.current) {
        const context = new AudioContextCtor();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;

        const source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);

        audioContextRef.current = context;
        analyserRef.current = analyser;
        sourceNodeRef.current = source;
      }

      if (audioContextRef.current.state !== "running") {
        await audioContextRef.current.resume();
      }

      visualizerAvailableRef.current = true;
      return true;
    } catch (error) {
      console.error("Visualizer audio hookup failed", error);
      visualizerAvailableRef.current = false;
      return false;
    }
  }

  function clampDesktopIconPosition(x: number, y: number) {
    const visibleWidth = Math.min(DESKTOP_WIDTH, window.innerWidth / Math.max(desktopScaleRef.current, 0.01));
    const visibleHeight = Math.min(DESKTOP_HEIGHT, window.innerHeight / Math.max(desktopScaleRef.current, 0.01));

    return {
      x: Math.min(Math.max(18, x), Math.max(18, visibleWidth - ICON_WIDTH - 18)),
      y: Math.min(Math.max(38, y), Math.max(38, visibleHeight - ICON_HEIGHT - 18)),
    };
  }

  function renderMenuGroup(menuKey: MenuKey) {
    return (
      <div
        key={menuKey}
        className="menu-group"
        onMouseEnter={() => setOpenMenu(menuKey)}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          className={`${
            menuKey === "apple" ? "apple-chip menu-trigger" : "menu-item"
          } ${openMenu === menuKey ? "menu-open" : ""}`}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
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
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            {menuKey === "apple"
              ? MENU_DEFINITIONS.apple.map((item) => (
                  <a
                    key={`${menuKey}-${item.label}`}
                    className="menu-dropdown-item menu-social-item"
                    href={(item as AppleMenuItem).href}
                    target="_blank"
                    rel="noreferrer"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <span className={`${(item as AppleMenuItem).iconClassName} menu-social-icon`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </a>
                ))
              : MENU_DEFINITIONS[menuKey].map((item, index) =>
                  "type" in item ? (
                    <div key={`${menuKey}-separator-${index}`} className="menu-separator" />
                  ) : (
                    <button
                      key={`${menuKey}-${item.label}`}
                      type="button"
                      className={`menu-dropdown-item ${(item as StandardMenuItem).enabled === false ? "menu-item-disabled" : ""}`}
                      disabled={(item as StandardMenuItem).enabled === false}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        if ((item as StandardMenuItem).enabled === false) {
                          return;
                        }
                        setOpenMenu(null);
                        handleMenuAction((item as StandardMenuItem).action);
                      }}
                    >
                      <span className="menu-item-main">
                        <span className="menu-check">{(item as StandardMenuItem).checked ? "✓" : ""}</span>
                        <span>{item.label}</span>
                      </span>
                      <span className="menu-item-meta">
                        {(item as StandardMenuItem).submenu ? "▶" : (item as StandardMenuItem).shortcut ?? ""}
                      </span>
                    </button>
                  ),
                )}
          </div>
        )}
      </div>
    );
  }

  function resetPlayerState() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    releaseActiveTab();
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
        headers: { "Content-Type": "application/json", ...getBrowserSessionHeaders() },
        body: JSON.stringify({ browser_session_id: getBrowserSessionId() }),
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
    setTabId(getTabId());
    setActivePlaybackTabId(getStoredActiveControllerTab());
  }, []);

  useEffect(() => {
    function syncActiveTab(event?: StorageEvent) {
      if (
        event &&
        event.key !== ACTIVE_CONTROLLER_TAB_STORAGE_KEY &&
        event.key !== LEGACY_ACTIVE_TAB_STORAGE_KEY
      ) {
        return;
      }
      setActivePlaybackTabId(getStoredActiveControllerTab());
    }

    window.addEventListener("storage", syncActiveTab);
    return () => {
      window.removeEventListener("storage", syncActiveTab);
    };
  }, []);

  useEffect(() => {
    sessionRef.current = session;
    sessionIdRef.current = session?.session_id ?? null;
  }, [session]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    desktopScaleRef.current = desktopScale;
  }, [desktopScale]);

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
    if (!canvas || !analyser || !visualizerOpen || !hasEnteredSystem) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const drawingContext = context;

    type VisualizerBall = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      shade: string;
      highlight: string;
    };

    const width = canvas.width;
    const height = canvas.height;
    const waveform = new Uint8Array(analyser.fftSize);
    const palette = [
      { color: "#ca5d50", shade: "#8b3a31", highlight: "#f0b0a6" },
      { color: "#d4a24c", shade: "#8e6a2b", highlight: "#f0d08f" },
      { color: "#6d9d72", shade: "#476d4d", highlight: "#bad1b6" },
      { color: "#688ab6", shade: "#415979", highlight: "#b4c7e2" },
      { color: "#9b74b4", shade: "#644878", highlight: "#d5bce0" },
      { color: "#b66c87", shade: "#7a465c", highlight: "#e3b9c7" },
    ];
    const balls: VisualizerBall[] = Array.from({ length: 8 }, (_, index) => {
      const tone = palette[index % palette.length];
      const radius = 11 + Math.random() * 6;
      return {
        x: 28 + Math.random() * (width - 56),
        y: height * 0.55 + Math.random() * (height * 0.25 - radius),
        vx: -1 + Math.random() * 2,
        vy: -2 + Math.random() * 4,
        radius,
        color: tone.color,
        shade: tone.shade,
        highlight: tone.highlight,
      };
    });

    let smoothedEnergy = 0;
    let previousSmoothedEnergy = 0;
    const energyHistory: number[] = [];
    let lastTriggerTime = 0;
    const triggerCooldownMs = 120;

    function drawBall(ball: VisualizerBall) {
      drawingContext.fillStyle = ball.color;
      drawingContext.beginPath();
      drawingContext.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      drawingContext.fill();

      drawingContext.strokeStyle = ball.shade;
      drawingContext.lineWidth = 1.5;
      drawingContext.beginPath();
      drawingContext.arc(ball.x, ball.y, ball.radius - 0.75, Math.PI * 0.2, Math.PI * 1.45);
      drawingContext.stroke();

      drawingContext.fillStyle = ball.highlight;
      drawingContext.beginPath();
      drawingContext.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.35, ball.radius * 0.35, 0, Math.PI * 2);
      drawingContext.fill();

      drawingContext.strokeStyle = "#3e3e3e";
      drawingContext.lineWidth = 1;
      drawingContext.beginPath();
      drawingContext.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      drawingContext.stroke();
    }

    function drawFrameBackground() {
      drawingContext.fillStyle = "#f1f1f1";
      drawingContext.fillRect(0, 0, width, height);
      drawingContext.fillStyle = "#e5e5e5";
      drawingContext.fillRect(0, 0, width, 16);
      drawingContext.fillStyle = "#d1d1d1";
      drawingContext.fillRect(0, height - 14, width, 14);
      drawingContext.strokeStyle = "#9a9a9a";
      drawingContext.lineWidth = 1;
      for (let x = 16; x < width; x += 32) {
        drawingContext.beginPath();
        drawingContext.moveTo(x, 0);
        drawingContext.lineTo(x, height);
        drawingContext.stroke();
      }
      drawingContext.strokeStyle = "#ffffff";
      drawingContext.strokeRect(0.5, 0.5, width - 1, height - 1);
      drawingContext.strokeStyle = "#7d7d7d";
      drawingContext.strokeRect(1.5, 1.5, width - 3, height - 3);
    }

    const draw = () => {
      if (visualizerAvailableRef.current && analyser) {
        analyser.getByteTimeDomainData(waveform);
      } else {
        waveform.fill(128);
      }

      let energySum = 0;
      for (let index = 0; index < waveform.length; index += 1) {
        energySum += Math.abs((waveform[index] - 128) / 128);
      }
      const rawEnergy = energySum / waveform.length;
      smoothedEnergy += (rawEnergy - smoothedEnergy) * 0.2;
      const previousFrameEnergy = previousSmoothedEnergy;
      energyHistory.push(smoothedEnergy);
      if (energyHistory.length > 30) {
        energyHistory.shift();
      }
      const avgEnergy =
        energyHistory.length > 0 ? energyHistory.reduce((sum, value) => sum + value, 0) / energyHistory.length : smoothedEnergy;
      const delta = smoothedEnergy - previousFrameEnergy;
      previousSmoothedEnergy = smoothedEnergy;

      const now = performance.now();
      if (isPlayingRef.current && now - visualizerDebugLogAtRef.current > 500) {
        visualizerDebugLogAtRef.current = now;
        console.log(
          "VIS_SAMPLE",
          waveform[0],
          "ENERGY",
          rawEnergy.toFixed(3),
          "SMOOTH",
          smoothedEnergy.toFixed(3),
          "AVG",
          avgEnergy.toFixed(3),
        );
      }

      const transientTriggered =
        isPlayingRef.current &&
        audioReady &&
        smoothedEnergy > avgEnergy * 1.3 &&
        smoothedEnergy > previousFrameEnergy &&
        now - lastTriggerTime > triggerCooldownMs;

      if (transientTriggered) {
        lastTriggerTime = now;
        const intensity = avgEnergy > 0 ? smoothedEnergy / avgEnergy : 1;
        const impulse = Math.max(6, Math.min(16, intensity * 6));
        console.log("TRANSIENT", { sample: waveform[0], energy: rawEnergy, smoothedEnergy, avgEnergy, intensity });
        for (const ball of balls) {
          ball.vy -= Math.max(8, 8 + Math.random() * 8);
          ball.vy -= impulse * 0.35;
          ball.vx += -1 + Math.random() * 2;
        }
      }

      drawFrameBackground();

      for (const ball of balls) {
        ball.vx *= 0.99;
        ball.vy *= 0.995;
        ball.vy += 0.4;

        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.x - ball.radius <= 4) {
          ball.x = ball.radius + 4;
          ball.vx = Math.abs(ball.vx) * 0.88;
        } else if (ball.x + ball.radius >= width - 4) {
          ball.x = width - ball.radius - 4;
          ball.vx = -Math.abs(ball.vx) * 0.88;
        }

        if (ball.y - ball.radius <= 4) {
          ball.y = ball.radius + 4;
          ball.vy *= -0.7;
        } else if (ball.y + ball.radius > height - 4) {
          ball.y = height - ball.radius - 4;
          ball.vy *= -0.7;
        }

        drawBall(ball);
      }

      if (!visualizerAvailableRef.current) {
        drawingContext.fillStyle = "#5f5f5f";
        drawingContext.font = "12px Charcoal, Geneva, sans-serif";
        drawingContext.fillText("Visualizer unavailable in this browser", 12, height - 14);
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
  }, [audioReady, hasEnteredSystem, isPlaying, visualizerOpen]);

  useEffect(() => {
    function updateDesktopScale() {
      const isCompactViewport = window.innerWidth <= 820 || window.innerHeight <= 700;
      setIsMobileLayout(isCompactViewport);
      const baseWidth = isCompactViewport ? 900 : 1280;
      const fittedScale = window.innerWidth / baseWidth;
      setDesktopScale(Math.max(0.75, fittedScale));
      setDesktopItems((current) =>
        current.map((item) => {
          if (item.passive) {
            return item;
          }
          const clamped = clampDesktopIconPosition(item.x, item.y);
          return clamped.x === item.x && clamped.y === item.y ? item : { ...item, ...clamped };
        }),
      );
    }

    updateDesktopScale();
    window.addEventListener("resize", updateDesktopScale);
    return () => {
      window.removeEventListener("resize", updateDesktopScale);
    };
  }, []);

  useEffect(() => {
    function closeMenu() {
      setOpenMenu(null);
    }

    function handleMove(event: PointerEvent) {
      if (!desktopDragRef.current) {
        return;
      }
      if (desktopDragRef.current.pointerId !== event.pointerId) {
        return;
      }

      const pointerX = event.clientX / desktopScaleRef.current;
      const pointerY = event.clientY / desktopScaleRef.current;
      const nextX = pointerX - desktopDragRef.current.offsetX;
      const nextY = pointerY - desktopDragRef.current.offsetY;
      const clamped = clampDesktopIconPosition(nextX, nextY);

      setDesktopItems((current) =>
        current.map((item) =>
          item.id === desktopDragRef.current?.id
            ? {
                ...item,
                x: clamped.x,
                y: clamped.y,
              }
            : item,
        ),
      );
    }

    function handleUp(event: PointerEvent) {
      if (!desktopDragRef.current || desktopDragRef.current.pointerId !== event.pointerId) {
        return;
      }
      desktopDragRef.current = null;
    }

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
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
          fetch(`${API_URL}/session/${activeSessionId}`, { headers: getBrowserSessionHeaders() }),
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
          headers: { "Content-Type": "application/json", ...getBrowserSessionHeaders() },
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
    if (sameSessionActiveInAnotherTab) {
      setPlaybackError("This session is already active in another tab.");
      setAudioDebug("blocked: active in another tab");
      return;
    }
    if (autoplayAttemptedSessionRef.current === activeSessionId) {
      return;
    }

    autoplayAttemptedSessionRef.current = activeSessionId;
    void handlePlay(true);
  }, [activeSessionId, hasEnteredSystem, isPlaying, sameSessionActiveInAnotherTab, session?.is_active, state?.status]);

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
    if (sameSessionActiveInAnotherTab) {
      setPlaybackError("This session is already active in another tab.");
      setIsPlaying(false);
      audioRef.current?.pause();
      return;
    }

    if (playbackError === "This session is already active in another tab.") {
      setPlaybackError(null);
    }
  }, [playbackError, sameSessionActiveInAnotherTab]);

  useEffect(() => {
    const handleUnload = () => {
      const currentSession = sessionRef.current;
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || !currentSession || currentSession.status === "ended") {
        return;
      }
      if (!tabId || getStoredActiveControllerTab() !== tabId) {
        return;
      }
      releaseActiveTab();
      void fetch(`${API_URL}/session/${currentSessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getBrowserSessionHeaders() },
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
  }, [tabId]);

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
    releaseActiveTab();
    const response = await fetch(`${API_URL}/session/${activeSessionId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getBrowserSessionHeaders() },
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

    if (sameSessionActiveInAnotherTab) {
      setPlaybackError("This session is already active in another tab.");
      setAudioDebug("blocked: active in another tab");
      return;
    }

    if (!audioRef.current) {
      setPlaybackError("Audio device unavailable.");
      setAudioDebug("blocked: missing audio element");
      return;
    }
    const nextSrc = `${API_URL}/audio/current?session=${currentSession.session_id}&browser_session_id=${encodeURIComponent(
      getBrowserSessionId(),
    )}`;
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
      await ensureVisualizerAudioGraph();

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
      claimActiveTab();
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
    releaseActiveTab();
    audioRef.current?.pause();
    setIsPlaying(false);
  }

  async function handleEnterSystem() {
    setBooting(true);
    setPlaybackError(null);
    setAudioDebug("booting");
    await ensureVisualizerAudioGraph();
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
      void ensureVisualizerAudioGraph();
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
      const startX = 20;
      const startY = 48;
      const stepX = 96;
      const stepY = 92;
      const visibleWidth = Math.min(DESKTOP_WIDTH, window.innerWidth / Math.max(desktopScaleRef.current, 0.01));
      const visibleHeight = Math.min(DESKTOP_HEIGHT, window.innerHeight / Math.max(desktopScaleRef.current, 0.01));
      const maxX = Math.max(startX, visibleWidth - ICON_WIDTH - 18);
      const maxY = Math.max(startY, visibleHeight - ICON_HEIGHT - 18);
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

      for (let column = 0; column < columns && !foundSlot; column += 1) {
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

      const nextPosition = clampDesktopIconPosition(startX + chosenColumn * stepX, startY + chosenRow * stepY);

      return [
        ...current,
        {
          id: `folder-${crypto.randomUUID()}`,
          label: nextLabel,
          iconClassName: "icon-folder",
          x: nextPosition.x,
          y: nextPosition.y,
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
      return;
    }
  }

  const mobileShortcuts = desktopItems.filter((item) => item.id !== "audio" && !item.passive);
  const isWaitingInQueue = Boolean(
    hasEnteredSystem && session && session.status === "queued" && !session.is_active && state?.status !== "dead",
  );

  if (isMobileLayout) {
    return (
      <div className="mobile-shell">
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
          }}
          onPlay={() => {
            setPlaybackError(null);
            setIsPlaying(true);
          }}
          onPause={() => {
            releaseActiveTab();
            setIsPlaying(false);
          }}
          onError={() => {
            const audio = audioRef.current;
            const mediaError = audio?.error;
            if (!mediaError) {
              setPlaybackError("Audio playback failed.");
              return;
            }

            const codeMap: Record<number, string> = {
              1: "Playback aborted.",
              2: "Network error while loading audio.",
              3: "Audio decoding failed.",
              4: "Audio format not supported by the browser.",
            };
            setPlaybackError(codeMap[mediaError.code] ?? "Unknown audio error.");
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

        <header className="mobile-menu-bar">
          <div className="mobile-menu-left menu-left">
            {(["apple", "file"] as const).map(renderMenuGroup)}
          </div>
          <div className="menu-right">
            <span>{clock}</span>
          </div>
        </header>

        {!hasEnteredSystem && state?.status !== "dead" && (
          <div className="mobile-boot-screen">
            <div className="boot-window mobile-boot-window">
              <div className="boot-inner">
                <div className="boot-logo-frame">
                  <div className="boot-logo" aria-hidden="true" />
                  <div className="boot-wordmark" aria-label="MitchOS 88">
                    <span className="boot-wordmark-mitch">Mitch</span>
                    <span className="boot-wordmark-os">OS</span>
                    <span className="boot-wordmark-version">88</span>
                  </div>
                </div>
                <div className="boot-status">{booting ? "Starting Up..." : "Tap to enter."}</div>
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

        {state?.status === "dead" && (
          <div className="mobile-overlay-card">
            <WindowTitleBar title="File Dead" closable={false} staticTitle />
            <div className="window-body mobile-panel-body">
              <p>The canonical WAV can no longer be used.</p>
              <p>This system has no recovery procedure.</p>
              <p>Total Damage: {state.total_damage.toFixed(2)}</p>
            </div>
          </div>
        )}

        {hasEnteredSystem && (
          <div className="mobile-content">
            <section className="mobile-shortcuts">
              {mobileShortcuts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mobile-shortcut"
                  onClick={() => handleDesktopItemOpen(item)}
                >
                  <span className={`${item.iconClassName} platinum-icon`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </section>

            {isWaitingInQueue && session && (
              <div className="mobile-overlay-card">
                <WindowTitleBar title="System Busy" closable={false} staticTitle />
                <div className="window-body mobile-panel-body">
                  <p>Another user is currently accessing this file.</p>
                  <p>Queue Position: {session.queue_position}</p>
                  <p>Estimated Wait: {formatSeconds(session.estimated_wait_seconds)}</p>
                </div>
              </div>
            )}

            <section className="mobile-panel">
              <WindowTitleBar title="Song Player" closable={false} staticTitle />
              <div className="window-body mobile-panel-body mobile-player-body">
                <div className="player-header">
                  <div className="player-logo" aria-hidden="true" />
                  <div className="track-title">{state?.filename ?? "Loading..."}</div>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className={`system-button ${isPlaying ? "pressed" : ""}`}
                    onClick={() => void handlePlay()}
                    disabled={controlsDisabled}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className={`system-button ${!isPlaying && audioReady ? "pressed" : ""}`}
                    onClick={handlePause}
                    disabled={controlsDisabled}
                  >
                    Pause
                  </button>
                </div>
                <div className="player-block">
                  <div>Progress</div>
                  <div className="meter-frame mobile-progress-frame">
                    <div className="meter-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div>{formatSeconds(playbackPosition)} / {formatSeconds(state?.duration_seconds ?? 0)}</div>
                </div>
                <div className="player-block">
                  <div>File Integrity:</div>
                  <div className="integrity-row">
                    <div className="meter-frame mobile-integrity-frame">
                      <div className="meter-fill" style={{ width: `${integrity}%` }} />
                    </div>
                    <span>{integrity}%</span>
                  </div>
                </div>
                <div className="player-block">
                  <div>Pause Remaining: {Math.max(0, 30 - Math.floor(pauseElapsed))}s</div>
                  <div>Status: {state?.status === "dead" ? "File Dead" : session?.is_active ? "Active" : "Waiting"}</div>
                  {sameSessionActiveInAnotherTab && <div>This session is already active in another tab.</div>}
                  {playbackError && <div>{playbackError}</div>}
                </div>
              </div>
            </section>

            {visualizerOpen && (
              <section className="mobile-panel">
                <WindowTitleBar title="Visualiser" onClose={() => setVisualizerOpen(false)} staticTitle />
                <div className="window-body mobile-panel-body">
                  <div className="visualizer-layout">
                    <div className="visualizer-caption">{isPlaying ? "Live Audio Monitor" : "Standing By"}</div>
                    <canvas ref={visualizerCanvasRef} className="mobile-visualizer-canvas" width={320} height={220} />
                  </div>
                </div>
              </section>
            )}

            {readMeOpen && (
              <section className="mobile-panel">
                <WindowTitleBar title="Read Me" onClose={() => setReadMeOpen(false)} staticTitle />
                <div className="window-body mobile-panel-body mobile-readme-body">
                  <pre className="readme-text mobile-readme-text">{readMeText}</pre>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="desktop-stage">
      <div className="desktop-scaler" style={{ width: `${1280 * desktopScale}px`, height: `${800 * desktopScale}px` }}>
    <div className="desktop-frame" style={{ transform: `scale(${desktopScale})` }}>
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
          releaseActiveTab();
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
          {(["apple", "file", "edit", "view", "special", "help"] as const).map(renderMenuGroup)}
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
            onPointerDown={(event) => {
              event.stopPropagation();
              const pointerX = event.clientX / desktopScaleRef.current;
              const pointerY = event.clientY / desktopScaleRef.current;
              desktopDragRef.current = {
                pointerId: event.pointerId,
                id: item.id,
                offsetX: pointerX - item.x,
                offsetY: pointerY - item.y,
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
        width={470}
        height={292}
        scale={desktopScale}
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
              disabled={controlsDisabled}
            >
              Play
            </button>
            <button
              type="button"
              className={`system-button ${!isPlaying && audioReady ? "pressed" : ""}`}
              onClick={handlePause}
              disabled={controlsDisabled}
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
            <div>File Integrity:</div>
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
            {sameSessionActiveInAnotherTab && <div>This session is already active in another tab.</div>}
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
          scale={desktopScale}
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
          scale={desktopScale}
          zIndex={frontWindow === "readme" ? 20 : 10}
          onFocus={() => setFrontWindow("readme")}
          closable
          onClose={() => setReadMeOpen(false)}
        >
          <pre className="readme-text">{readMeText}</pre>
        </DesktopWindow>
      )}

      {isWaitingInQueue && session && (
        <div className="queue-overlay">
          <div className="queue-window">
            <WindowTitleBar title="System Busy" closable={false} staticTitle />
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
            <WindowTitleBar title="File Dead" closable={false} staticTitle />
            <div className="queue-body">
              <p>The canonical WAV can no longer be used.</p>
              <p>This system has no recovery procedure.</p>
              <p>Total Damage: {state.total_damage.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

    </main>
    </div>
    </div>
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
    </div>
  );
}
