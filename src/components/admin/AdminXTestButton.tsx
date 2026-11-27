"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Send } from "lucide-react";

export function AdminXTestButton(): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  const handleSendTest = async (): Promise<void> => {
    if (
      !confirm(
        "Send a harmless connection test post to your connected X account via Buffer now?",
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/x-test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert(data.message || data.error || "X test post failed");
        return;
      }
      alert(data.message || "Test post sent to X via Buffer!");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      isLoading={busy}
      disabled={busy}
      onClick={handleSendTest}
      title="Admin-only: sends a harmless verification post to X via Buffer"
    >
      <Send className="w-3.5 h-3.5" />
      <span>Send test post to X</span>
    </Button>
  );
}
