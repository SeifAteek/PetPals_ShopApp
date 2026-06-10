import React from 'react';
import { useTheme } from './ThemeProvider.jsx';
import { darkBgGradient, meshConicStops, meshOrbs, PP } from './petpals-tokens.js';

/**
 * Pixel-match of iOS `PetPalsAmbientBackground`:
 * - Dark: ONLY `darkBackgroundGradient` (no orbs, no mesh sweep)
 * - Light: honeydew base + meshGradient + overlay + 5 orbs + bottom vignette
 */
export default function MeshBackground() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (isDark) {
    return (
      <div
        className="pp-mesh pp-mesh--dark"
        aria-hidden
        style={{ background: darkBgGradient }}
      />
    );
  }

  return (
    <div className="pp-mesh pp-mesh--light" aria-hidden>
      <div className="pp-mesh-base" style={{ backgroundColor: PP.honeydew }} />
      <div
        className="pp-mesh-conic"
        style={{
          background: `conic-gradient(from -45deg at 50% 45%, ${meshConicStops})`,
        }}
      />
      <div
        className="pp-mesh-wash"
        style={{
          background: `linear-gradient(135deg,
            rgba(242, 164, 165, 0.35) 0%,
            rgba(242, 255, 233, 0.25) 45%,
            rgba(9, 0, 135, 0.18) 100%)`,
        }}
      />
      {meshOrbs.map((orb, i) => (
        <div
          key={i}
          className="pp-mesh-orb"
          style={{
            width: orb.size,
            height: orb.size,
            left: `calc(50% + ${orb.ox}px)`,
            top: `calc(50% + ${orb.oy}px)`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: orb.color,
            opacity: orb.lightOpacity,
            filter: `blur(${orb.blur}px)`,
          }}
        />
      ))}
      <div
        className="pp-mesh-vignette"
        style={{
          background: `linear-gradient(180deg, transparent 0%, rgba(9, 0, 135, 0.06) 100%)`,
        }}
      />
    </div>
  );
}
