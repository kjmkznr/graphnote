import { App } from './app.js';

async function main(): Promise<void> {
  const app = new App();
  await app.init();
}

main().catch((err) => {
  const errorEl = document.getElementById('init-error');
  if (!errorEl) return;
  errorEl.textContent = `初期化エラー\n${err instanceof Error ? err.message : String(err)}`;
  errorEl.classList.remove('hidden');
  console.error('Failed to initialize graphnote:', err);
});
