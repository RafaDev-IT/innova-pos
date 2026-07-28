/**
 * Registro del service worker.
 *
 * Solo en compilaciones de producción. En desarrollo, un service worker
 * interceptando peticiones convierte cualquier cambio en una sesión de dudas
 * sobre si lo que se ve es el código nuevo o una copia guardada.
 *
 * También se exige HTTPS (o localhost), que es donde el navegador lo permite.
 */
export default function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Que falle el registro no debe impedir usar la aplicación: sin service
      // worker simplemente no hay funcionamiento sin conexión.
    });
  });
}
