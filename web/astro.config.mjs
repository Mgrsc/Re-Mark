import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    maxDuration: 60
  }),
  server: {
    host: '0.0.0.0',
    port: 4321
  }
});
