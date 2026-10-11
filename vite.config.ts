import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    mode === 'development' && {
      name: 'plano-msproject-local',
      configureServer(server) {
        server.middlewares.use('/_local/msproject/natal-2026', (_requisicao, resposta) => {
          const arquivo = path.resolve(__dirname, 'tmp/natal-2026-v21.pre-importacao.json');
          if (!fs.existsSync(arquivo)) {
            resposta.statusCode = 404;
            resposta.end('Plano local do Project não encontrado.');
            return;
          }
          resposta.setHeader('Content-Type', 'application/json; charset=utf-8');
          fs.createReadStream(arquivo).pipe(resposta);
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
