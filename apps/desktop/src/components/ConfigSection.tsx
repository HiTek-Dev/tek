import type { ReactNode } from 'react';

interface ConfigSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function ConfigSection({ title, description, children }: ConfigSectionProps) {
  return (
    <div className="bg-surface-secondary rounded-lg p-6 mb-4">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {description && (
        <p className="text-sm text-text-secondary mt-1">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}
