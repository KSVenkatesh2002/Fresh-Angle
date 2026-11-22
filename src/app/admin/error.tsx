"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error("Admin Mission Control error:", error);
  }, [error]);

  return (
    <div className="py-16 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-danger/10 border border-danger/20 text-danger flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-7 h-7" />
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-danger mb-2">
        Admin Runtime Error
      </p>

      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-3">
        Mission Control Error
      </h1>

      <p className="text-foreground-muted text-sm max-w-sm mx-auto mb-8 leading-relaxed">
        An error occurred while loading this admin telemetry view. Telemetry has logged the event.
      </p>

      <div className="flex items-center justify-center gap-3">
        <Button onClick={() => reset()} variant="primary" className="gap-2">
          <RotateCcw className="w-4 h-4" />
          <span>Retry Operation</span>
        </Button>
        <Link href="/admin">
          <Button variant="outline" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
