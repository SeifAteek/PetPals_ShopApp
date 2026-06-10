import React from 'react';
import MeshBackground from './MeshBackground.jsx';
import ThemeToggle from './ThemeToggle.jsx';

/**
 * Shared portal chrome: mesh backdrop + optional header actions.
 */
export function PortalLoading({ message = 'Loading…' }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center">
      <MeshBackground />
      <div className="pp-card relative z-10 flex flex-col items-center gap-4 px-10 py-8">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--pp-blush)] border-t-transparent" />
        <p className="animate-pulse font-medium text-[var(--pp-text-muted)]">{message}</p>
      </div>
    </div>
  );
}

export function PortalHeader({ title, children }) {
  return (
    <header className="pp-header pp-header--float flex shrink-0 items-center">
      <h2 className="text-lg font-bold text-[var(--pp-text-primary)]">{title}</h2>
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}

export { default as GlassSurface } from './GlassSurface.jsx';
export { MeshBackground, ThemeToggle };
