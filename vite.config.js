import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Change this to match your GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: "Ping-Me", // 
});
