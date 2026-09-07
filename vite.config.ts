import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (!env.VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required')
  }
  const apiUrl = new URL(env.VITE_API_BASE_URL)

  return {
    plugins: [vue()],
    server: {
      host: '127.0.0.1',
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
