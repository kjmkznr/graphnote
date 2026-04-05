import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [topLevelAwait()],
  resolve: {
    alias: {
      'egrph-wasm': '/Users/kkojima/src/github.com/kjmkznr/egrph/egrph-wasm/pkg/egrph_wasm.js',
    },
  },
  optimizeDeps: {
    exclude: ['egrph-wasm'],
  },
  server: {
    fs: {
      // egrph-wasm/pkg が graphnote の親ディレクトリに存在するため許可
      allow: ['..'],
    },
  },
});
