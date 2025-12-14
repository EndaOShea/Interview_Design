import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // For local development only - load from .env
        // In production (Docker), this will be loaded from window.ENV at runtime
        'process.env.API_KEY': mode === 'development'
          ? JSON.stringify(env.GEMINI_API_KEY)
          : JSON.stringify(undefined),
        'process.env.GEMINI_API_KEY': mode === 'development'
          ? JSON.stringify(env.GEMINI_API_KEY)
          : JSON.stringify(undefined)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
