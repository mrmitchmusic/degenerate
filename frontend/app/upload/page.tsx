"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import type { GlobalState } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const ADMIN_TOKEN_STORAGE_KEY = "mitch-os-88-admin-token";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [uploadEnabled, setUploadEnabled] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedState, setUploadedState] = useState<GlobalState | null>(null);

  const selectedLabel = useMemo(() => {
    if (!file) {
      return "No WAV selected";
    }
    return `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
  }, [file]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setUploadedState(null);
    setError(null);
    setFile(event.target.files?.[0] ?? null);
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (savedToken) {
      setAdminToken(savedToken);
    }

    void (async () => {
      try {
        const response = await fetch(`${API_URL}/admin/status`);
        const payload = (await response.json()) as { upload_enabled: boolean };
        setUploadEnabled(payload.upload_enabled);
      } catch {
        setUploadEnabled(false);
      }
    })();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a WAV file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsSubmitting(true);
    setError(null);
    setUploadedState(null);

    try {
      const response = await fetch(`${API_URL}/admin/upload`, {
        method: "POST",
        headers: adminToken ? { "X-Admin-Token": adminToken } : undefined,
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail ?? "Upload failed");
      }

      const nextState = (await response.json()) as GlobalState;
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
      setUploadedState(nextState);
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="upload-page">
      <section className="upload-card">
        <div className="upload-title-bar">
          <span className="mitch-menu-logo" aria-hidden="true" />
          <span>Upload New Track</span>
        </div>

        <div className="upload-body">
          <p>
            Upload a replacement WAV for the live system. This resets the destructive state and the public player
            will show the real uploaded filename.
          </p>

          {uploadEnabled === false && (
            <p className="upload-error">
              Uploads are currently locked. Set <code>MITCH_OS_88_ADMIN_TOKEN</code> on the backend first.
            </p>
          )}

          <form className="upload-form" onSubmit={(event) => void handleSubmit(event)}>
            <label className="upload-field">
              <span>WAV File</span>
              <input type="file" accept=".wav,audio/wav" onChange={handleFileChange} />
            </label>

            <div className="upload-selected">{selectedLabel}</div>

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
              <button type="submit" className="system-button" disabled={isSubmitting || uploadEnabled === false}>
                {isSubmitting ? "Uploading..." : "Replace Live Track"}
              </button>
              <Link href="/" className="upload-link">
                Back to Mitch OS 88
              </Link>
            </div>
          </form>

          {error && <p className="upload-error">{error}</p>}

          {uploadedState && (
            <div className="upload-success">
              <p>Live track replaced successfully.</p>
              <p>Filename: {uploadedState.filename}</p>
              <p>Duration: {uploadedState.duration_seconds.toFixed(2)}s</p>
              <p>Status reset to: {uploadedState.status}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
