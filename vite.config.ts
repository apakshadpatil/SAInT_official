import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Force Vite to use the ESM build shipped with the package
      '@supabase/supabase-js': resolve(__dirname, 'node_modules/@supabase/supabase-js/dist/index.mjs'),
    },
  },
});
