import React from 'react';

export type BadgeVariant = 'live' | 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'gold';

const variants: Record<BadgeVariant, string> = {
  live: 'bg-pitch-500/15 text-pitch-400 border border-pitch-500/30',
  success: 'bg-pitch-500/15 text-pitch-400 border border-pitch-500/30',
  info: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  warning: 'bg-gold-500/15 text-gold-400 border border-gold-500/30',
  danger: 'bg-wicket-500/15 text-wicket-400 border border-wicket-500/30',
  neutral: 'bg-surface-alt text-ink-secondary border border-border-strong',
  gold: 'bg-gold-500/15 text-gold-400 border border-gold-500/30',
};

interface BadgeProps {
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}

export default function Badge({ variant = 'neutral', pulse = false, className = '', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${variants[variant]} ${className}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />}
      {children}
    </span>
  );
}
