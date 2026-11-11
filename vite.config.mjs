import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(process.cwd(), 'client'),
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { outDir: path.resolve(process.cwd(), 'public'), emptyOutDir: true },
});
