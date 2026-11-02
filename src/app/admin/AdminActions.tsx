'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Play, LogOut } from 'lucide-react';

export function AdminActions(): React.JSX.Element {
  const router = useRouter();
  const [generating, setGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(
    null
  );

  const handleGenerate = async (): Promise<void> => {
    if (!confirm('Run the full daily publishing pipeline now? This will discover a topic, research, synthesize, and publish a post.')) {
      return;
    }

    setGenerating(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/generate', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setStatusMessage({ text: 'Pipeline finished! Refreshing...', isError: false });
      router.refresh();
    } catch (err: unknown) {
      setStatusMessage({ text: (err as Error).message, isError: true });
    } finally {
      setGenerating(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      {statusMessage && (
        <span
          className={`text-xs px-2.5 py-1 rounded-md border ${
            statusMessage.isError
              ? 'bg-danger/10 border-danger/20 text-danger'
              : 'bg-success/10 border-success/20 text-success'
          }`}
        >
          {statusMessage.text}
        </span>
      )}

      <Button
        onClick={handleGenerate}
        variant="primary"
        size="sm"
        isLoading={generating}
        className="gap-1.5"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Generate Now</span>
      </Button>

      <Button onClick={handleLogout} variant="outline" size="sm" className="gap-1.5">
        <LogOut className="w-3.5 h-3.5" />
        <span>Exit Session</span>
      </Button>
    </div>
  );
}
