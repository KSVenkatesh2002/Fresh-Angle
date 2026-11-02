'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <main className="py-24 sm:py-32">
      <Container size="narrow">
        <div className="text-center p-8 sm:p-12 rounded-2xl border border-border bg-surface shadow-sm">
          <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
            Something unexpected occurred
          </h1>

          <p className="text-foreground-muted text-sm sm:text-base max-w-md mx-auto mb-8">
            We encountered a temporary issue while rendering this page. Our telemetry has logged
            the event.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => reset()} variant="primary" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>Try Again</span>
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
            >
              Go to Home
            </Button>
          </div>
        </div>
      </Container>
    </main>
  );
}
