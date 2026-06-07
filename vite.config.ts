/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/f1-tipping-game/',
  test: {
    environment: 'node',
    globals: true,
    pool: 'vmForks',
  },
})
