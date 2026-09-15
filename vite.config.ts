import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (!env.VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required')
  }
  const apiUrl = new URL(env.VITE_API_BASE_URL, 'http://127.0.0.1:8090')

  return {
    plugins: [vue()],
    server: {
      // Bind all local interfaces so localhost (IPv4/IPv6) and 127.0.0.1
      // use the same dev proxy for the Feishu OAuth request.
      host: '::',
      port: 5173,
      proxy: {
        [apiUrl.pathname]: {
          target: apiUrl.origin,
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false,
    },
  }
})
