import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Production security headers live in vercel.json; `npm run preview` serves the build with the same headers.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { headers: { key: string; value: string }[] }[];
};
const securityHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));

export default defineConfig({
  plugins: [react()],
  // assetsInlineLimit 0: never inline fonts as data: URIs, which the Content Security Policy (font-src 'self') blocks.
  build: { sourcemap: false, chunkSizeWarningLimit: 1200, assetsInlineLimit: 0 },
  preview: { headers: securityHeaders },
});
