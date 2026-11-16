import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    css: {
      postcss: {
        plugins: [
          tailwindcss({
            content: ["./index.html", "./src/**/*.{js,jsx}"],
            theme: {
              extend: {
                fontFamily: {
                  sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
                  mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
                },
              },
            },
          }),
          autoprefixer(),
        ],
      },
    },
    server: {
      port: 5173,
      proxy: { "/api": { target: env.API_PROXY_TARGET || "http://localhost:8080", changeOrigin: true } },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            data: ["@tanstack/react-query", "axios", "react-hook-form"],
          },
        },
      },
    },
  };
});