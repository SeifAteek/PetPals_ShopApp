const petpalsPreset = require('./shared-web-theme/tailwind.preset.cjs')

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [petpalsPreset],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
}
