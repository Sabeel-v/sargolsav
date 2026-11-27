import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Reach older phones still in use: iOS 14+, Android Chrome / Samsung
    // Internet from ~2020. Vite's default only covers browsers from 2023+.
    target: ['es2020', 'chrome87', 'safari14', 'firefox78', 'edge88'],
  },
})
