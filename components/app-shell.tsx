"use client";

import { usePathname } from "next/navigation";

const BARE_ROUTES = ["/", "/login", "/register"];

export function AppShell({
  children,
  sidebar,
  topbar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare = pathname === "/" || BARE_ROUTES.some((p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`)));

  if (bare) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebar}
      <div className="flex flex-1 flex-col overflow-hidden">
        {topbar}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
