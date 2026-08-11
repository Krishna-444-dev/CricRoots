export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-pitch-500 text-[#06170D] hover:bg-pitch-400 focus-visible:ring-pitch-500 shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]',
  secondary: 'bg-surface-alt text-ink border border-border-strong hover:bg-surface-hover focus-visible:ring-border-strong',
  outline: 'bg-transparent text-ink border border-border-strong hover:bg-surface-hover focus-visible:ring-border-strong',
  ghost: 'bg-transparent text-ink-secondary hover:text-ink hover:bg-surface-hover focus-visible:ring-border-strong',
  danger: 'bg-wicket-500 text-white hover:bg-wicket-600 focus-visible:ring-wicket-500',
  accent: 'bg-gold-500 text-[#241503] hover:bg-gold-400 focus-visible:ring-gold-500',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-base px-6 py-3',
};

export function buttonVariants(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = ''): string {
  return [base, variants[variant], sizes[size], className].filter(Boolean).join(' ');
}
