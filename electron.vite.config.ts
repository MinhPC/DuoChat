import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } } },
  },
  // Preload chạy trong sandbox nên không được tách chunk dùng chung:
  // hai file preload không import chung module nào (xem tests/ipc.test.ts).
  preload: {
    build: {
      rollupOptions: {
        input: {
          shell: resolve(__dirname, 'src/preload/shell.ts'),
          service: resolve(__dirname, 'src/preload/service.ts'),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } } },
    plugins: [
      react(),
      {
        // CSP chỉ cho bản build (dev cần script inline của HMR).
        name: 'duochat-csp',
        transformIndexHtml(html, ctx) {
          if (ctx.server) return html
          const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
          const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`
          return html.replace('<head>', `<head>\n    ${meta}`)
        },
      },
    ],
  },
})
