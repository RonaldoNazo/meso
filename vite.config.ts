import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Relative base keeps the site working on github.io/<repo>/ and on custom
// domains without configuration. Hash routing means no 404 fallback is needed.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
