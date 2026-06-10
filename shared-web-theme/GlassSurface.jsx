import React from 'react';

const RADIUS = {
  flat: 'pp-liquid-glass--flat',
  sm: 'pp-liquid-glass--sm',
  md: 'pp-liquid-glass--md',
  lg: 'pp-liquid-glass--lg',
  xl: 'pp-liquid-glass--xl',
  pill: 'pp-liquid-glass--pill',
};

const ELEVATION = {
  none: '',
  resting: 'pp-liquid-glass--resting',
  raised: 'pp-liquid-glass--raised',
  floating: 'pp-liquid-glass--floating',
};

/**
 * iOS `GlassSurface` / `GlassCardModifier` — blur, card fill, brand tint, gradient stroke.
 */
export default function GlassSurface({
  as: Component = 'div',
  radius = 'lg',
  elevation = 'raised',
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={[
        'pp-liquid-glass',
        RADIUS[radius] ?? RADIUS.lg,
        ELEVATION[elevation] ?? ELEVATION.raised,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </Component>
  );
}
