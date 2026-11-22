import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FileQuestion, ArrowLeft, LayoutDashboard } from "lucide-react";

export default function AdminNotFound(): React.JSX.Element {
  return (
    <div className="py-16 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-surface-muted border border-border text-primary flex items-center justify-center mx-auto mb-6">
        <FileQuestion className="w-7 h-7" />
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
        Admin 404
      </p>

      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-3">
        Admin Page Not Found
      </h1>

      <p className="text-foreground-muted text-sm max-w-sm mx-auto mb-8 leading-relaxed">
        The requested Mission Control management route does not exist or has been relocated.
      </p>

      <div className="flex items-center justify-center gap-3">
        <Link href="/admin">
          <Button variant="primary" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span>Mission Control Dashboard</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
