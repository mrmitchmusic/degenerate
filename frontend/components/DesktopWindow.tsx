"use client";

import { ReactNode, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

type DesktopWindowProps = {
  title: string;
  initialPosition: { x: number; y: number };
  width: number;
  height: number;
  scale?: number;
  zIndex: number;
  onFocus: () => void;
  children: ReactNode;
  closable?: boolean;
  onClose?: () => void;
};

type WindowTitleBarProps = {
  title: string;
  closable?: boolean;
  onClose?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  staticTitle?: boolean;
};

export function WindowTitleBar({
  title,
  closable = true,
  onClose,
  onPointerDown,
  staticTitle = false,
}: WindowTitleBarProps) {
  return (
    <div
      className={`window-title-bar ${staticTitle ? "static-title" : ""}`}
      onPointerDown={onPointerDown}
    >
      <button
        type="button"
        className="close-box"
        aria-label={closable ? `Close ${title}` : `${title} cannot be closed`}
        disabled={!closable}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onClose?.();
        }}
      />
      <div className="title-bar-stripes" aria-hidden="true" />
      <span className="window-title-text">{title}</span>
      <div className="title-bar-stripes" aria-hidden="true" />
    </div>
  );
}

export function DesktopWindow({
  title,
  initialPosition,
  width,
  height,
  scale = 1,
  zIndex,
  onFocus,
  children,
  closable = true,
  onClose,
}: DesktopWindowProps) {
  const [position, setPosition] = useState(initialPosition);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number } | null>(null);

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      if (!dragRef.current) {
        return;
      }
      const viewportWidth = 1280;
      const viewportHeight = 800;
      const nextX = dragRef.current.left + (event.clientX - dragRef.current.startX) / scale;
      const nextY = dragRef.current.top + (event.clientY - dragRef.current.startY) / scale;
      setPosition({
        x: Math.min(Math.max(0, nextX), Math.max(0, viewportWidth - width)),
        y: Math.min(Math.max(22, nextY), Math.max(22, viewportHeight - height)),
      });
    }

    function handleUp(event: PointerEvent) {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }
      dragRef.current = null;
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [height, scale, width]);

  return (
    <section
      className="desktop-window"
      style={{ width, height, left: position.x, top: position.y, zIndex }}
      onPointerDown={onFocus}
    >
      <WindowTitleBar
        title={title}
        closable={closable}
        onClose={onClose}
        onPointerDown={(event) => {
          onFocus();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            left: position.x,
            top: position.y,
          };
        }}
      />
      <div className="window-body">{children}</div>
    </section>
  );
}
