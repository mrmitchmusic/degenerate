"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AdminOverview } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const ADMIN_TOKEN_STORAGE_KEY = "mitch-os-88-admin-token";

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value: number | null) {
  if (!value) {
    return "—";
  }
  return new Date(value * 1000).toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (savedToken) {
      setAdminToken(savedToken);
    }
  }, []);

  async function loadOverview(tokenOverride?: string) {
    const token = tokenOverride ?? adminToken;
    if (!token) {
      setError("Enter your admin token first.");
      setOverview(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/admin/overview`, {
        headers: {
          "X-Admin-Token": token,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail ?? "Failed to load admin overview");
      }

      const nextOverview = (await response.json()) as AdminOverview;
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
      setOverview(nextOverview);
    } catch (loadError) {
      setOverview(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin overview");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!adminToken) {
      return;
    }
    void loadOverview(adminToken);
  }, [adminToken]);

  const queueRows = useMemo(() => overview?.queue ?? [], [overview]);

  return (
    <main className="upload-page">
      <section className="upload-card admin-card">
        <div className="upload-title-bar">
          <span className="mitch-menu-logo" aria-hidden="true" />
          <span>Mitch OS 88 Admin</span>
        </div>

        <div className="upload-body">
          <p>Private dashboard for live song stats, visits, queue state, and IP visibility.</p>

          <div className="upload-form">
            <label className="upload-field">
              <span>Admin Token</span>
              <input
                type="password"
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="Required private token"
              />
            </label>

            <div className="upload-actions">
              <button type="button" className="system-button" disabled={isLoading} onClick={() => void loadOverview()}>
                {isLoading ? "Loading..." : "Refresh Admin View"}
              </button>
              <Link href="/upload" className="upload-link">
                Upload Track
              </Link>
              <Link href="/" className="upload-link">
                Back to Mitch OS 88
              </Link>
            </div>
          </div>

          {error && <p className="upload-error">{error}</p>}

          {overview && (
            <>
              <section className="admin-metrics">
                <div className="admin-metric">
                  <span className="admin-metric-label">Filename</span>
                  <strong>{overview.state.filename}</strong>
                </div>
                <div className="admin-metric">
                  <span className="admin-metric-label">Status</span>
                  <strong>{overview.state.status}</strong>
                </div>
                <div className="admin-metric">
                  <span className="admin-metric-label">Sessions</span>
                  <strong>{overview.session_count}</strong>
                </div>
                <div className="admin-metric">
                  <span className="admin-metric-label">Weighted Plays</span>
                  <strong>{overview.state.play_count.toFixed(2)}</strong>
                </div>
                <div className="admin-metric">
                  <span className="admin-metric-label">Visits</span>
                  <strong>{overview.visit_count}</strong>
                </div>
                <div className="admin-metric">
                  <span className="admin-metric-label">Total Damage</span>
                  <strong>{overview.state.total_damage.toFixed(2)}</strong>
                </div>
              </section>

              <section className="admin-panel">
                <h2>Active Listener</h2>
                {overview.active_session ? (
                  <div className="admin-session-card">
                    <p>IP: {overview.active_session.ip_address ?? "Unknown"}</p>
                    <p>Listening: {formatSeconds(overview.active_session.listened_seconds)}</p>
                    <p>Paused: {formatSeconds(overview.active_session.paused_seconds)}</p>
                    <p>Started: {formatDateTime(overview.active_session.started_at)}</p>
                  </div>
                ) : (
                  <div className="upload-selected">No active listener right now.</div>
                )}
              </section>

              <section className="admin-panel">
                <h2>Queue</h2>
                {queueRows.length ? (
                  <div className="admin-queue-table">
                    <div className="admin-queue-header">
                      <span>Pos</span>
                      <span>Status</span>
                      <span>IP Address</span>
                      <span>Waiting Since</span>
                    </div>
                    {queueRows.map((item) => (
                      <div key={item.session_id} className="admin-queue-row">
                        <span>{item.queue_position}</span>
                        <span>{item.status}</span>
                        <span>{item.ip_address ?? "Unknown"}</span>
                        <span>{formatDateTime(item.created_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="upload-selected">Queue is currently empty.</div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
