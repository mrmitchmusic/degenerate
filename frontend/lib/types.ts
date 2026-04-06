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
