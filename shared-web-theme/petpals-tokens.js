/** Exact PetPals classic palette — keep in sync with iOS `PetPalsPalette.swift` */

export const PP = {
  honeydew: '#F1FBF2',    /* Mint cream — light theme base */
  powderBlush: '#C8E6C9', /* Light sage green */
  almondCream: '#D1E7DD', /* Soft green tint */
  richCerulean: '#2E7D32', /* Forest green — primary brand color */
  navy: '#1B5E20',        /* Deep forest green */
  navyDark: '#0B250E',    /* Dark forest green base for dark theme */
};

function blendHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar * (1 - t) + br * t);
  const g = Math.round(ag * (1 - t) + bg * t);
  const bVal = Math.round(ab * (1 - t) + bb * t);
  return `#${[r, g, bVal].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** iOS `darkBackgroundGradient` stops — deep forest green base */
export const darkBgGradient = `linear-gradient(180deg,
  ${PP.navyDark} 0%,
  ${blendHex(PP.navyDark, PP.richCerulean, 0.32)} 28%,
  ${blendHex(PP.navy, PP.richCerulean, 0.4)} 52%,
  ${blendHex(PP.navy, PP.powderBlush, 0.52)} 78%,
  rgba(200, 230, 201, 0.88) 100%)`;

/** iOS `meshGradientStops` for conic mesh */
export const meshConicStops = [
  blendHex(PP.powderBlush, PP.richCerulean, 0.35),
  'rgba(200, 230, 201, 0.9)',
  PP.honeydew,
  PP.almondCream,
  'rgba(27, 94, 32, 0.92)',
  'rgba(46, 125, 50, 0.75)',
  blendHex(PP.powderBlush, PP.honeydew, 0.5),
].join(', ');

/** iOS `meshOrbs` — size, blur, offset (from center), colors */
export const meshOrbs = [
  {
    color: blendHex(PP.powderBlush, PP.richCerulean, 0.4),
    size: 340,
    blur: 88,
    ox: -130,
    oy: -200,
    lightOpacity: 0.5,
    darkOpacity: 0.28,
  },
  {
    color: PP.powderBlush,
    size: 300,
    blur: 78,
    ox: 150,
    oy: -80,
    lightOpacity: 0.45,
    darkOpacity: 0.22,
  },
  {
    color: blendHex(PP.honeydew, PP.almondCream, 0.45),
    size: 380,
    blur: 95,
    ox: 20,
    oy: 40,
    lightOpacity: 0.55,
    darkOpacity: 0.18,
  },
  {
    color: PP.navy,
    size: 320,
    blur: 85,
    ox: -100,
    oy: 340,
    lightOpacity: 0.35,
    darkOpacity: 0.45,
  },
  {
    color: PP.richCerulean,
    size: 280,
    blur: 72,
    ox: 120,
    oy: 300,
    lightOpacity: 0.38,
    darkOpacity: 0.3,
  },
];
