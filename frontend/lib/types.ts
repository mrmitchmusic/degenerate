export type GlobalState = {
  play_count: number;
  total_damage: number;
  status: "alive" | "dead";
  filename: string;
  duration_seconds: number;
  sample_rate: number;
  integrity_percent: number;
};

export type SessionSnapshot = {
  session_id: string;
  queue_position: number;
  is_active: boolean;
  status: "queued" | "active" | "ended";
  listened_seconds: number;
  paused_seconds: number;
  started_at: number | null;
  last_heartbeat: number | null;
  estimated_wait_seconds: number;
  max_pause_seconds: number;
};

export type SessionOpenResponse = {
  session: SessionSnapshot;
  state: GlobalState;
};

export type AdminSessionInfo = {
  session_id: string;
  browser_session_id: string;
  status: "queued" | "active" | "ended";
  queue_position: number;
  ip_address: string | null;
  listened_seconds: number;
  paused_seconds: number;
  created_at: number;
  started_at: number | null;
  last_heartbeat: number | null;
};

export type AdminOverview = {
  state: GlobalState;
  visit_count: number;
  session_count: number;
  active_session: AdminSessionInfo | null;
  queue: AdminSessionInfo[];
};
