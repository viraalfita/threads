import { ThemeToggle } from "./theme-toggle";
import { getActiveUser, listMyAccounts } from "@/lib/user";
import { AccountSwitcher } from "./account-switcher";
import { LogoutButton } from "./settings/logout-button";

export async function Topbar() {
  const [accounts, active] = await Promise.all([
    listMyAccounts().catch(() => []),
    getActiveUser().catch(() => null),
  ]);

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-background px-4 md:px-6">
      <div className="md:hidden font-semibold">ThreadLens</div>
      <div className="ml-auto flex items-center gap-3">
        <AccountSwitcher accounts={accounts} activeId={active?.id ?? null} />
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
