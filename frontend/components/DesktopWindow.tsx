"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type DesktopWindowProps = {
  title: string;
  initialPosition: { x: number; y: number };
  width: number;
  height: number;
  zIndex: number;
  onFocus: () => void;
  children: ReactNode;
  closable?: boolean;
  onClose?: () => void;
};

export function DesktopWindow({
  title,
  initialPosition,
  width,
  height,
  zIndex,
  onFocus,
  children,
  closable = true,
  onClose,
}: DesktopWindowProps) {
  const [position, setPosition] = useState(initialPosition);
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);

  useEffect(() => {
    function handleMove(event: MouseEvent) {
      if (!dragRef.current) {
        return;
      }
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const nextX = dragRef.current.left + (event.clientX - dragRef.current.startX);
      const nextY = dragRef.current.top + (event.clientY - dragRef.current.startY);
      setPosition({
        x: Math.min(Math.max(0, nextX), Math.max(0, viewportWidth - width)),
        y: Math.min(Math.max(22, nextY), Math.max(22, viewportHeight - height)),
      });
    }

    function handleUp() {
      dragRef.current = null;
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [height, width]);

  return (
    <section
      className="desktop-window"
      style={{ width, height, left: position.x, top: position.y, zIndex }}
      onMouseDown={onFocus}
    >
      <div
        className="window-title-bar"
        onMouseDown={(event) => {
          onFocus();
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            left: position.x,
            top: position.y,
          };
        }}
      >
        <button
          type="button"
          className="close-box"
          aria-label={closable ? `Close ${title}` : `${title} cannot be closed`}
          disabled={!closable}
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
        />
        <div className="title-bar-stripes" aria-hidden="true" />
        <span className="window-title-text">{title}</span>
        <div className="title-bar-stripes" aria-hidden="true" />
      </div>
      <div className="window-body">{children}</div>
    </section>
  );
}
