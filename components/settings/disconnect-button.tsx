"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function DisconnectButton({ userId, label }: { userId?: string; label?: string } = {}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/threads/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Disconnect failed");
      } else {
        toast.success("Disconnected. Semua data akun telah dihapus.");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" /> {label ?? "Disconnect"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect Threads?</DialogTitle>
          <DialogDescription>
            Akun, semua post, insights, dan riwayat analisa LLM akan dihapus permanen dari database lokal.
            Akun Threads kamu di Meta tidak terpengaruh.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
          <Button variant="destructive" onClick={disconnect} disabled={busy}>
            {busy ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
