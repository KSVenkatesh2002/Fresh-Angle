import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'accent' | 'outline' | 'success' | 'warning';
}

export function Badge({
  variant = 'default',
  className = '',
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  const base =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors';

  const variants = {
    default: 'bg-surface-muted text-foreground border border-border',
    primary: 'bg-primary/10 text-primary border border-primary/20',
    accent: 'bg-accent/10 text-accent border border-accent/20',
    outline: 'border border-border text-foreground-muted',
    success: 'bg-success/10 text-success border border-success/20',
    warning: 'bg-warning/10 text-warning border border-warning/20',
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
