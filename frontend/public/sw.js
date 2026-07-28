/* eslint-env serviceworker */

/**
 * Service worker de Innova POS.
 *
 * El objetivo es que la aplicación abra al instante y siga abriendo sin
 * conexión, sin que eso llegue nunca a falsear un dato de negocio. En un punto
 * de venta, servir una respuesta guardada como si fuera fresca es peor que no
 * responder: un precio viejo se cobra mal y un total viejo descuadra la caja.
 *
 * De ahí las tres reglas:
 *
 *   1. Las escrituras (POST, PATCH, DELETE) no se tocan jamás. Registrar una
 *      venta tiene que llegar al servidor o fallar de forma visible; una venta
 *      "guardada" que en realidad se quedó en el navegador es dinero perdido.
 *   2. Las lecturas de la API van primero a la red. Solo si no hay conexión se
 *      recurre a la copia, y se marca con una cabecera para que la interfaz
 *      pueda advertirlo.
 *   3. Los recursos compilados llevan un hash en el nombre, así que su
 *      contenido nunca cambia: se sirven de la copia sin preguntar.
 */

const VERSION = 'v1';
const CACHE_SHELL = `innova-pos-shell-${VERSION}`;
const CACHE_ASSETS = `innova-pos-assets-${VERSION}`;
const CACHE_API = `innova-pos-api-${VERSION}`;

/** Lo mínimo para que la aplicación pinte algo sin conexión. */
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png', '/icons/icon-192.png'];

/** Rutas de la API cuya respuesta nunca se guarda. */
const NUNCA_EN_CACHE = ['/auth/', '/health'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      // `reload` evita que el propio navegador sirva una copia vieja al sembrar
      // la caché, que dejaría al service worker instalando una versión pasada.
      cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
  // No se llama a skipWaiting() a propósito: la versión nueva espera a que se
  // cierren las pestañas abiertas. Reemplazar el código en caliente a mitad de
  // una venta es exactamente lo que no debe pasar en una caja.
});

self.addEventListener('activate', (event) => {
  const vigentes = [CACHE_SHELL, CACHE_ASSETS, CACHE_API];
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => !vigentes.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Recursos con hash en el nombre: su contenido no cambia nunca. */
function esInmutable(url) {
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/');
}

function esApi(url) {
  return url.pathname.startsWith('/api/') || url.pathname === '/api';
}

/** Copia servida sin conexión, marcada para que la interfaz pueda avisarlo. */
function marcarComoCopia(respuesta) {
  const cabeceras = new Headers(respuesta.headers);
  cabeceras.set('X-Innova-Desde-Cache', '1');
  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET. Un POST no se cachea ni se reintenta: debe llegar o fallar.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Peticiones a otros orígenes (la API desplegada, imágenes de productos):
  // se dejan pasar sin intervenir. Guardar respuestas de terceros añade
  // superficie de error sin beneficio claro.
  if (url.origin !== self.location.origin) return;

  if (esApi(url)) {
    if (NUNCA_EN_CACHE.some((p) => url.pathname.includes(p))) return;
    event.respondWith(redPrimero(request));
    return;
  }

  if (esInmutable(url)) {
    event.respondWith(cachePrimero(request));
    return;
  }

  // Navegaciones: red primero para que un despliegue nuevo se note, con el
  // armazón guardado como red de seguridad.
  if (request.mode === 'navigate') {
    event.respondWith(navegacion(request));
  }
});

async function cachePrimero(request) {
  const copia = await caches.match(request);
  if (copia) return copia;

  const respuesta = await fetch(request);
  if (respuesta.ok) {
    const cache = await caches.open(CACHE_ASSETS);
    cache.put(request, respuesta.clone());
  }
  return respuesta;
}

async function redPrimero(request) {
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) {
      const cache = await caches.open(CACHE_API);
      cache.put(request, respuesta.clone());
    }
    return respuesta;
  } catch (error) {
    const copia = await caches.match(request);
    if (copia) return marcarComoCopia(copia);
    throw error;
  }
}

async function navegacion(request) {
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put('/index.html', respuesta.clone());
    }
    return respuesta;
  } catch (error) {
    // El enrutador funciona en modo history: cualquier ruta se resuelve con el
    // mismo documento, así que el armazón guardado sirve para todas.
    return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
  }
}
