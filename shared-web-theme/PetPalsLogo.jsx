import React from 'react';
import { useTheme } from './ThemeProvider.jsx';

const LOGO = {
  light: `${import.meta.env.BASE_URL}petpals-logo-black.png`,
  dark: `${import.meta.env.BASE_URL}petpals-logo-white.png`,
};

/** Wordmark lives on a square canvas — size the box, not just height. */
const SIZE_CLASS = {
  xs: 'h-7 w-[4.5rem]',
  sm: 'h-8 w-[5.5rem]',
  md: 'h-10 w-[7rem]',
  lg: 'h-12 w-[8.5rem]',
  xl: 'h-16 w-[11rem]',
  '2xl': 'h-24 w-[16rem]',
  hero: 'h-28 w-[18rem]',
};

export default function PetPalsLogo({ size = 'md', className = '', alt = 'PetPals' }) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? LOGO.dark : LOGO.light;

  return (
    <img
      src={src}
      alt={alt}
      className={`${SIZE_CLASS[size] || SIZE_CLASS.md} shrink-0 object-contain object-center ${className}`}
      draggable={false}
    />
  );
}

export function PetPalsBrand({
  logoSize = 'md',
  subtitle,
  badge,
  className = '',
  badgeClassName = '',
  stacked = false,
}) {
  return (
    <div
      className={`flex min-w-0 ${stacked ? 'flex-col items-start gap-1.5' : 'items-center gap-3'} ${className}`}
    >
      <PetPalsLogo size={logoSize} />
      {(subtitle || badge) && (
        <div className="min-w-0">
          {badge && (
            <span
              className={
                badgeClassName ||
                'ml-0.5 rounded-full bg-brand-400/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand-500'
              }
            >
              {badge}
            </span>
          )}
          {subtitle && (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--pp-text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
