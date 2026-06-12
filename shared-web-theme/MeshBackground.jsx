import React from 'react';
import { useTheme } from './ThemeProvider.jsx';
import { darkBgGradient, PP } from './petpals-tokens.js';

/**
 * Pixel-match of iOS `PetPalsAmbientBackground`:
 * - Dark: ONLY `darkBackgroundGradient` (no orbs, no mesh sweep)
 * - Light: Flat Mint Cream background (PP.honeydew) with no gradient wash or mesh orbs.
 */
export default function MeshBackground() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (isDark) {
    return (
      <div
        className="pp-mesh pp-mesh--dark"
        aria-hidden
        style={{ background: 'var(--pp-bg, #0B110B)' }}
      />
    );
  }

  return (
    <div className="pp-mesh pp-mesh--light" aria-hidden style={{ backgroundColor: PP.honeydew }}>
      <div className="pp-mesh-base" style={{ backgroundColor: PP.honeydew }} />
    </div>
  );
}
