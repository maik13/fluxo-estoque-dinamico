import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { realpathSync } from "node:fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
const raiz = realpathSync(process.cwd());

export default defineConfig(({ mode }) => ({
  // O worktree pode ser acessado por um caminho junction no Windows. Fixar a
  // raiz impede o Rollup de tratar index.html como um nome de arquivo absoluto
  // durante o build de produção.
  root: raiz,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(raiz, "./src"),
    },
  },
}));
