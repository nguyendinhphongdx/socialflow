import { defineConfig } from 'tsup'
import { copy } from 'esbuild-plugin-copy'

export default defineConfig({
  entry: {
    'background/index': 'src/background/index.ts',
    'content-scripts/tiktok': 'src/content-scripts/tiktok.ts',
    'content-scripts/facebook': 'src/content-scripts/facebook.ts',
    'content-scripts/instagram': 'src/content-scripts/instagram.ts',
    'content-scripts/youtube': 'src/content-scripts/youtube.ts',
    'popup/popup': 'src/popup/popup.ts',
  },
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: process.env.NODE_ENV !== 'production',
  target: 'chrome120',
  // Bundle workspace + 3rd-party deps vào output (extension không có node_modules runtime)
  noExternal: [
    '@sociflow/common',
    '@sociflow/ws-protocol',
    'socket.io-client',
    'zod',
  ],
  esbuildPlugins: [
    copy({
      assets: [
        { from: 'public/**/*', to: '.' },
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
      ],
    }),
  ],
})
