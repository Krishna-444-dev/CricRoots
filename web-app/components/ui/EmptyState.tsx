import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon = '🏏', title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4 border border-dashed border-border-strong rounded-xl">
      <div className="text-4xl mb-3 opacity-60">{icon}</div>
      <p className="text-ink font-medium">{title}</p>
      {description && <p className="text-ink-secondary text-sm mt-1">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
