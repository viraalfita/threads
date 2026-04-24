"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";

export interface SwitcherAccount {
  id: string;
  username: string | null;
  name: string | null;
  threads_user_id: string;
  threads_profile_picture_url: string | null;
}

export function AccountSwitcher({
  accounts,
  activeId,
}: {
  accounts: SwitcherAccount[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const active = accounts.find((a) => a.id === activeId) ?? accounts[0];

  async function setActive(userId: string) {
    if (!active || userId === active.id) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/accounts/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "switch_failed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal pindah akun");
    } finally {
      setSwitching(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <Button asChild size="sm">
        <Link href="/api/auth/threads">
          <Plus className="h-4 w-4" /> Connect Threads
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" disabled={switching}>
          <Avatar className="h-6 w-6">
            {active?.threads_profile_picture_url && (
              <AvatarImage src={active.threads_profile_picture_url} alt={active.username ?? ""} />
            )}
            <AvatarFallback className="text-xs">
              {(active?.username ?? "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline max-w-[140px] truncate">
            @{active?.username ?? active?.threads_user_id}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Akun Threads</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onSelect={() => setActive(a.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Avatar className="h-6 w-6">
              {a.threads_profile_picture_url && (
                <AvatarImage src={a.threads_profile_picture_url} alt={a.username ?? ""} />
              )}
              <AvatarFallback className="text-xs">
                {(a.username ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">@{a.username ?? a.threads_user_id}</div>
              {a.name && <div className="text-xs text-muted-foreground truncate">{a.name}</div>}
            </div>
            {a.id === active?.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/api/auth/threads" className="flex items-center gap-2 cursor-pointer">
            <Plus className="h-4 w-4" /> Tambah akun Threads
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
