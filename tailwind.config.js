import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // Gizmo ran pieces in a fixed-size app container. In a browser, 100vh ignores the
      // mobile address bar, so "screen" means the dynamic viewport instead.
      height: { screen: '100dvh' },
      minHeight: { screen: '100dvh' },
      maxHeight: { screen: '100dvh' },
    },
  },
  plugins: [animate],
};
