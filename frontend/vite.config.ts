import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // React chama /api/... e o Vite redireciona para o Django
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },

      // SSE também passa pelo proxy
      // (EventSource usa GET normal; o proxy do Vite costuma funcionar bem)
      "/api/jobs/stream": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})