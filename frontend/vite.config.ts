import { fileURLToPath } from "node:url"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const srcPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src")

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": srcPath },
  },
})
