import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative so the same build works at github.io/labs/ and proxied under the portfolio's /lab-files/
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@gizmo/runtime': fileURLToPath(new URL('./src/gizmoRuntime.js', import.meta.url)),
    },
  },
});
