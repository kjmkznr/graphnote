import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm()],
  base: '/graphnote/',
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('cytoscape')) {
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@kjmkznr/egrph-wasm'],
  },
});
