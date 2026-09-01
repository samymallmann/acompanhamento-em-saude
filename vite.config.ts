import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Tailwind v4 é um plugin do Vite — não existe mais tailwind.config.js nem
  // postcss.config.js por padrão. O tema fica no próprio CSS (src/index.css),
  // com a diretiva @theme. Atenção ao estudar: a maioria dos tutoriais online
  // ainda é da v3 e manda criar esses arquivos.
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Permite `import { Button } from '@/components/ui/Button'` em vez de
      // '../../../components/ui/Button'. Precisa estar espelhado no tsconfig.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
