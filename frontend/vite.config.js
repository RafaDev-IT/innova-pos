import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';

// Se usa Vite con `@vitejs/plugin-vue2` en lugar de Vue CLI: Vue CLI depende de
// webpack 4, que rompe con Node >= 17 por el cambio de OpenSSL y obligaría a
// arrancar con `--openssl-legacy-provider`. El framework sigue siendo Vue 2.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vue y Vuetify cambian mucho menos que el código de la aplicación:
        // separarlos deja que el navegador conserve el vendor en caché entre
        // despliegues.
        manualChunks: {
          vendor: ['vue', 'vuetify'],
        },
      },
    },
  },
  server: {
    port: 5173,
    watch: {
      // Sondeo en lugar de eventos del sistema de archivos. Cuando el proyecto
      // vive en una ruta de Windows montada en WSL (/mnt/c), el sistema 9p no
      // emite eventos inotify y la recarga en caliente deja de funcionar en
      // silencio: se edita un archivo y el navegador nunca se entera.
      usePolling: true,
      interval: 400,
    },
    // Proxy hacia la API: el navegador solo habla con el origen de Vite, así que
    // en desarrollo no hay CORS de por medio.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.spec.js'],
    server: {
      deps: {
        // Vuetify 2 se distribuye sin ESM completo; Vitest necesita procesarlo.
        inline: ['vuetify'],
      },
    },
  },
});
