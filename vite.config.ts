import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    // A porta respeita PORT quando ele vem do ambiente, e cai em 8080 quando não vem.
    //
    // Por que: `npm run dev` na mão continua abrindo em 8080, como sempre. Mas com
    // duas frentes de trabalho na mesma árvore, o segundo a subir esbarrava num
    // 8080 já ocupado e simplesmente não subia. Agora quem sobe depois recebe uma
    // porta livre em vez de conflito.
    //
    // 8080 não é obrigatória: não aparece em callback de OAuth, webhook nem CORS —
    // conferido, este arquivo era a única ocorrência dela no projeto.
    port: Number(process.env.PORT) || 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
