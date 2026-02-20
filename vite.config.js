import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'rewrite-projects',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/projects' || req.url === '/projects/') {
            req.url = '/projects/index.html';
          }
          if (req.url === '/resume' || req.url === '/resume/') {
            req.url = '/resume/index.html';
          }
          next();
        });
      },
    },
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        projects: resolve(__dirname, 'projects/index.html'),
        resume: resolve(__dirname, 'resume/index.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  // Serve model/ as static assets
  publicDir: 'public',
});
