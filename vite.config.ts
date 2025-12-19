import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo-name>/, so assets must use that base path.
  // Repo: https://github.com/Alexandr-Paleev/Snake3DGame
  base: '/Snake3DGame/',
  plugins: [react()],
})
