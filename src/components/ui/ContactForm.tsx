'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';

export function ContactForm(): React.JSX.Element {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, website }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit message');
      }

      setSuccess(true);
    } catch {
      setError('Unable to submit your message. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-3 text-center sm:text-left">
        <div className="flex items-center gap-2 text-success font-semibold text-base">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Transmission Received</span>
        </div>
        <p className="text-sm text-foreground-muted leading-relaxed">
          Thank you for reaching out. Our editorial team reviews inbound transmissions daily.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3.5 rounded-xl bg-surface border border-danger/40 text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Honeypot field - hidden from real users */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Your Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Jane Doe"
          className="w-full px-3.5 py-2 text-sm rounded-lg bg-surface text-foreground border border-border placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="jane@example.com"
          className="w-full px-3.5 py-2 text-sm rounded-lg bg-surface text-foreground border border-border placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="subject" className="block text-sm font-medium text-foreground">
          Subject / Paper Title
        </label>
        <input
          id="subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          placeholder="Correction or paper submission"
          className="w-full px-3.5 py-2 text-sm rounded-lg bg-surface text-foreground border border-border placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="message" className="block text-sm font-medium text-foreground">
          Message / Details
        </label>
        <textarea
          id="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          placeholder="Provide context, URL links, or specific claims you'd like our editorial engine to inspect..."
          className="w-full px-3.5 py-2 text-sm rounded-lg bg-surface text-foreground border border-border placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={submitting}
        className="gap-2 w-full sm:w-auto"
      >
        <Send className="w-4 h-4" />
        <span>{submitting ? 'Submitting...' : 'Submit Transmission'}</span>
      </Button>
    </form>
  );
}
