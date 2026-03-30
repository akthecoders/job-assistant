import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs'

// Wraps content scripts in an IIFE to prevent minified variable name collisions
// when multiple content scripts run in the same page context (Chrome MV3 isolated world).
function wrapContentScripts() {
  const targets = new Set(['content.js', 'autofill.js'])
  return {
    name: 'wrap-content-scripts',
    generateBundle(_opts: unknown, bundle: Record<string, { type: string; code?: string }>) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (targets.has(fileName) && chunk.type === 'chunk' && chunk.code) {
          chunk.code = `;(function(){\n${chunk.code}\n})();\n`
        }
      }
    },
  }
}

// Plugin that copies manifest.json, assets/, and flattens HTML output
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    closeBundle() {
      const root = __dirname
      const dist = resolve(root, 'dist')

      // Copy manifest.json
      copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'))

      // Copy assets (icons etc.) if they exist
      const assetsDir = resolve(root, 'assets')
      const distAssetsDir = resolve(dist, 'assets')
      if (!existsSync(distAssetsDir)) mkdirSync(distAssetsDir, { recursive: true })
      if (existsSync(assetsDir)) {
        for (const file of readdirSync(assetsDir)) {
          copyFileSync(resolve(assetsDir, file), resolve(distAssetsDir, file))
        }
      }

      // Flatten HTML files from dist/src/** to dist/
      const htmlMappings: Array<[string, string]> = [
        [resolve(dist, 'src/popup/popup.html'), resolve(dist, 'popup.html')],
        [resolve(dist, 'src/sidepanel/sidepanel.html'), resolve(dist, 'sidepanel.html')],
      ]
      for (const [src, dest] of htmlMappings) {
        if (existsSync(src)) {
          copyFileSync(src, dest)
          console.log(`[chrome-ext] Copied ${src} -> ${dest}`)
        }
      }

      console.log('[chrome-ext] manifest.json and assets copied to dist/')
    },
  }
}

export default defineConfig({
  plugins: [react(), wrapContentScripts(), chromeExtensionPlugin()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content/extractor.ts'),
        autofill: resolve(__dirname, 'src/content/autofill.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
