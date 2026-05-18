"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Largeur en px (default 640 — drawer création CP du mockup). */
  width?: number;
  children?: React.ReactNode;
}

const EASE_APPLE = [0.2, 0, 0, 1] as const;

// useSyncExternalStore est servi pour détecter si on est côté client
// sans le pattern "setState in useEffect" (déconseillé en React 19).
const subscribeNoop = () => () => {};
const useIsMounted = () =>
  React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

export function Drawer({
  open,
  onOpenChange,
  width = 640,
  children,
}: DrawerProps) {
  const mounted = useIsMounted();

  // Lock body scroll quand drawer ouvert
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC pour fermer
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_APPLE }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 backdrop-blur-md"
            style={{ background: "rgba(0,0,0,0.20)" }}
            aria-hidden="true"
          />
          <motion.aside
            key="drawer-panel"
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ duration: 0.18, ease: EASE_APPLE }}
            role="dialog"
            aria-modal="true"
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
            style={{
              width,
              maxWidth: "100vw",
              background: "var(--bg-base)",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.20)",
              borderTopLeftRadius: 32,
            }}
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function DrawerHeader({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-8 pt-7 pb-5", className)}>{children}</div>
  );
}

export function DrawerBody({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-8 pb-6 space-y-5", className)}
    >
      {children}
    </div>
  );
}

export function DrawerFooter({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-8 py-5 flex items-center justify-between",
        className,
      )}
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        borderTopLeftRadius: 24,
      }}
    >
      {children}
    </div>
  );
}
