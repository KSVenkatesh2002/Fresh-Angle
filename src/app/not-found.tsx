import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { FileQuestion, ArrowLeft, Search } from 'lucide-react';

export default function NotFound(): React.JSX.Element {
  return (
    <main className="py-24 sm:py-32">
      <Container size="narrow">
        <div className="text-center p-8 sm:p-12 rounded-2xl border border-border bg-surface shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-surface-muted border border-border text-primary flex items-center justify-center mx-auto mb-6">
            <FileQuestion className="w-7 h-7" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
            404 Error
          </p>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-4">
            Page Not Found
          </h1>

          <p className="text-foreground-muted text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
            The article or resource you are looking for might have been archived, renamed, or is temporarily unavailable.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/">
              <Button variant="primary" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Homepage</span>
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="outline" className="gap-2">
                <Search className="w-4 h-4" />
                <span>Search Articles</span>
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
