import * as React from "react";
import { UserButton } from "@clerk/nextjs";

import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";

export interface AppShellProps {
  user: { name: string; email: string; orgName: string };
  children: React.ReactNode;
}

/**
 * Layout des pages authentifiées : sidebar + glass header + main scrollable.
 * Server component qui prend les infos user via props (fetchées dans le layout).
 */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <AppSidebar user={user} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="glass sticky top-0 z-30 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="px-10 py-3 flex items-center justify-end gap-3">
            <ThemeToggle />
            <UserButton
              appearance={{ elements: { avatarBox: "w-9 h-9" } }}
            />
          </div>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
