import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/labs/',
  plugins: [react()],
  resolve: {
    alias: {
      '@gizmo/runtime': fileURLToPath(new URL('./src/gizmoRuntime.js', import.meta.url)),
    },
  },
});
