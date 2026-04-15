import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages project sites live under /<repo>/; CI sets BASE_PATH (see .github/workflows)
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
});
