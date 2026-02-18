import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split Three.js into its own chunk
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  // Serve model/ as static assets
  publicDir: 'public',
});
