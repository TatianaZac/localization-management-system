// Цей файл налаштовує Vite та підключає підтримку React під час розробки й збірки.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
