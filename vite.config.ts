import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

const pwaManifestContent = JSON.stringify(
  {
    name: 'GameMind',
    short_name: 'GameMind',
    description: 'مساعد الألعاب الذكي بالذكاء الاصطناعي — فحص حقيقي للجهاز وتشخيص التقطيع',
    start_url: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#0B0E14',
    theme_color: '#0EA5E9',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/src/assets/images/gamemind_app_icon_1794674350490.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any maskable',
      },
    ],
  },
  null,
  2,
);

function gameMindPwaManifestPlugin(): Plugin {
  return {
    name: 'gamemind-pwa-manifest',
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        res.end(pwaManifestContent);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: pwaManifestContent,
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), gameMindPwaManifestPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
