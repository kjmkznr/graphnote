import { App } from './app.js';

async function main(): Promise<void> {
  const app = new App();
  await app.init();
}

main().catch((err) => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `
      <div style="color:#f87171;font-size:14px;text-align:center;padding:24px;max-width:480px">
        <p style="margin-bottom:8px;font-weight:bold">初期化エラー</p>
        <p style="font-family:monospace;font-size:12px;word-break:break-all">${String(err)}</p>
      </div>
    `;
  }
  console.error('Failed to initialize graphnote:', err);
});
