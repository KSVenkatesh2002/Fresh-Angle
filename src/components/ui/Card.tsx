import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export function Card({
  hoverEffect = false,
  className = '',
  children,
  ...props
}: CardProps): React.JSX.Element {
  return (
    <div
      className={`bg-surface border border-border text-foreground rounded-xl overflow-hidden transition-all duration-200 ${
        hoverEffect ? 'hover:shadow-md hover:border-primary/50' : 'shadow-sm'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`p-6 pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`p-6 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={`p-6 pt-0 border-t border-border mt-auto flex items-center justify-between text-sm text-foreground-muted ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
