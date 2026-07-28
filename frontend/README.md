# Innova POS — Interfaz

Aplicación web del punto de venta. Vue 2.7 + Vuetify 2.7, empaquetada con Vite e
instalable como PWA.

> Para la visión general del proyecto y el despliegue conjunto, ver el
> [README de la raíz](../README.md).

---

## Índice

- [Puesta en marcha](#puesta-en-marcha)
- [Estructura](#estructura)
- [Pantallas](#pantallas)
- [Sistema de diseño](#sistema-de-diseño)
- [Sesión y permisos](#sesión-y-permisos)
- [Dinero y validación](#dinero-y-validación)
- [Códigos de barras](#códigos-de-barras)
- [Gráficas](#gráficas)
- [PWA y adaptación a pantallas](#pwa-y-adaptación-a-pantallas)
- [Pruebas](#pruebas)
- [Comandos](#comandos)

---

## Puesta en marcha

```bash
npm install
npm run dev          # http://localhost:5173
```

El servidor de desarrollo hace de proxy hacia la API local en el puerto 3000, de
modo que el navegador solo habla con un origen y no hay CORS de por medio.

Para compilar apuntando a una API desplegada, la URL vive en `.env.production` y
se resuelve **al compilar**, no en tiempo de ejecución:

```bash
npm run build        # usa VITE_API_BASE_URL de .env.production
```

### Por qué Vite y no Vue CLI

Vue CLI depende de webpack 4, que falla con Node ≥ 17 por el cambio de proveedor
de OpenSSL y obligaría a arrancar con `--openssl-legacy-provider`. Vite con
`@vitejs/plugin-vue2` compila el mismo Vue 2 sin ese lastre.

Dos detalles del mismo orden:

- **vue-router 3**, no 4: la 4 requiere Vue 3.
- **Vuetify precompilado** (`import Vuetify from 'vuetify'`) en lugar de
  `vuetify/lib`, que exige `sass ~1.32`.

---

## Estructura

```
src/
├── views/           Una por ruta (8), todas cargadas de forma perezosa
├── components/      22 componentes reutilizables
│   └── charts/      Gráficas en SVG, sin librería externa
├── services/        Cliente HTTP y un servicio por recurso
│   ├── http.js          Interceptores, errores tipados, detección de caída
│   ├── token.js         Almacenamiento del token (módulo aparte, ver abajo)
│   └── authService.js   Sesión, con perfil en local para modo sin conexión
├── store/
│   └── session.js   El único estado global
├── styles/
│   └── design-system.css   Tokens y clases compartidas (~1 200 líneas)
├── utils/           format · money · ean13
└── plugins/         Vuetify, temas claro y oscuro
```

`token.js` vive separado de `authService.js` a propósito: el cliente HTTP
necesita leer el token para firmar cada petición, y si estuviera dentro de
`authService` —que a su vez usa el cliente HTTP— se formaría un ciclo de
importación.

### Estado global

Un objeto reactivo de Vue, no Vuex:

```js
const state = Vue.observable({ user: null, permissions: [], roleLabel: '' });
```

El estado verdaderamente global de esta aplicación es el usuario en curso y sus
permisos. Una dependencia completa de gestión de estado para eso añade ceremonia
sin resolver nada.

---

## Pantallas

![Punto de venta](../docs/screenshots/punto-de-venta.png)

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | Punto de venta | Todos |
| `/ventas` | Historial con ticket y anulación | `sales.view` |
| `/tablero` | Indicadores del día | `dashboard.view` |
| `/reportes` | Reportería y exportación CSV | `reports.view` |
| `/usuarios` | Gestión de cuentas | `users.manage` |
| `/cuenta` | Perfil y cambio de contraseña | Todos |
| `/login` | Acceso | Público |

### Punto de venta

Catálogo con foto, nombre, código y precio a la izquierda; venta en curso a la
derecha. Búsqueda por **nombre o código de barras**, con atajos de teclado
(`F2` buscar, `F9` cobrar) porque en una caja el ratón sobra.

Cada renglón de la venta permite **cambiar el precio** —lo pedía el documento— y
quitarse. El precio ajustado queda marcado y aparece luego en un reporte
específico: es dinero cobrado por debajo del catálogo y el dueño querrá verlo.

![Inicio de sesión](../docs/screenshots/login.png)

La pantalla de acceso reparte 70 % imagen y 30 % formulario. Los atajos con
credenciales de ejemplo **solo se compilan** cuando `VITE_SHOW_DEMO_ACCOUNTS`
está activo; en un build normal desaparecen del paquete.

### Resumen de permisos al entrar

Al iniciar sesión se abre una vez el detalle de lo que el rol permite, agrupado
por área, y debajo lo que **no** incluye. Saber qué falta es tan informativo
como saber qué hay, y evita descubrirlo más tarde con un botón que no está.

La bandera que lo dispara se levanta solo en `login()`, nunca al restaurar la
sesión guardada: si no, reaparecería en cada recarga y pasaría de informar a
estorbar.

---

## Sistema de diseño

`styles/design-system.css` concentra los tokens y las clases compartidas.
Nomenclatura tipo BEM (`.panel`, `.panel__head`, `.nav__item--active`), más
`<style scoped>` en cada componente para lo que es exclusivo suyo.

Dirección visual: claro, aireado, minimalista. Tarjetas blancas sobre lienzo
gris muy claro, radios generosos, sombras casi imperceptibles, verde como único
acento. **La separación se consigue con el contraste entre lienzo y superficie,
no con líneas.**

```css
--pos-canvas:  #eff1f3;   /* fondo sobre el que flotan las tarjetas */
--pos-surface: #ffffff;
--pos-primary: #12a150;   /* verde de marca */
```

### Temas

Claro y oscuro, ambos con su propia paleta —el oscuro **no** es un aclarado
automático del claro—. El tema claro es el predeterminado.

Antes se heredaba la preferencia del sistema operativo, y el resultado era que
la misma instalación se veía distinta en dos cajas del mismo comercio según cómo
tuviera cada quien configurado Windows. Ahora arranca en claro y recuerda la
elección manual.

### Cifras

`font-variant-numeric: tabular-nums` en toda la aplicación. Sin eso los precios
bailan de fila en fila y una columna de importes se vuelve difícil de leer.

---

## Sesión y permisos

`session.can()` sirve para **ocultar botones, no para proteger datos**. La
autorización real está en el servidor; la interfaz solo evita ofrecer acciones
que van a ser rechazadas.

El enrutador declara el permiso de cada ruta en `meta.permission` y un guard lo
comprueba antes de entrar, redirigiendo a `/403` cuando falta.

### Estado de la API

La barra superior indica si la API responde. Se revalida cada 15 segundos y
además de inmediato ante un error de conectividad: comprobarlo solo al arrancar
haría que siguiera anunciando «En línea» mucho después de que la API cayera.

El cliente HTTP distingue **«la API no responde»** de **«credenciales
incorrectas»**. Sin esa distinción, un cajero reescribe una y otra vez una
contraseña que era correcta.

### Sesión sin conexión

`restore()` descartaba el token ante cualquier error, incluida la falta de red.
Eso expulsaba una sesión válida a una pantalla de acceso que sin conexión
tampoco funciona.

Ahora el token solo se descarta cuando el servidor **rechaza de verdad** (401 o
403). Sin red se conserva el perfil guardado localmente y la barra avisa; en
cuanto vuelve la conexión, la siguiente petición revalida.

---

## Dinero y validación

Los importes se manejan en **centavos enteros** y viajan como cadena. Nunca en
coma flotante.

`AmountField.vue` envuelve el campo de texto y filtra la entrada **mientras se
escribe**: descarta letras y símbolos, admite la coma decimal del teclado
latino, conserva un solo separador y corta en dos decimales.

Antes `2.99999` se guardaba como `3.00` y `1.005` como `1.00`, sin avisar de
nada. Ahora el cliente lo impide al teclear y el servidor lo rechaza si llega.

Un detalle de implementación: al reenviar los escuchadores al campo interno hay
que **excluir `input` y `blur`**, o el componente los emite dos veces y el
filtrado se pisa a sí mismo.

---

## Códigos de barras

`utils/ean13.js` implementa el estándar completo: dígito verificador, tablas de
codificación L/G/R, patrón de paridad según el primer dígito y los 95 módulos.

`BarcodeImage.vue` lo dibuja en SVG agrupando módulos contiguos, lo que reduce
95 rectángulos a unos 31. Cuando el código no es un EAN-13 válido no se inventa
nada: se indica que no tiene representación gráfica.

`BarcodeScanner.vue` usa la **API nativa `BarcodeDetector`** cuando existe y
recurre a `@zxing/browser` en su defecto. La biblioteca se carga de forma
perezosa, en un fragmento aparte de 443 kB que solo se descarga si de verdad
hace falta.

---

## Gráficas

Escritas a mano en SVG, sin librería. Siguen una metodología explícita: la forma
antes que el color, paleta validada con comprobador (banda de luminosidad, croma
y contraste ≥ 3:1), sin leyenda para una sola serie, barras de 24 px como máximo
con extremo redondeado de 4 px, y **un valor cero no dibuja marca**.

Cada gráfica ofrece su **alternativa en tabla**, que es el canal accesible
cuando la forma o el color no llegan.

El dimensionado usa `ResizeObserver` para mantener el `viewBox` a escala 1:1 con
el contenedor. Sin eso el texto se renderizaba a 6 px y quedaba una banda vacía
a media anchura.

---

## PWA y adaptación a pantallas

### Instalable

| Pieza | Dónde |
|---|---|
| Manifiesto | `public/manifest.webmanifest` |
| Service worker | `public/sw.js` |
| Iconos | `public/icons/` — 192, 256, 384, 512 y dos *maskable* |
| Registro | `src/registerServiceWorker.js` |

Los iconos *maskable* llevan la marca al **58 %** del lienzo: Android recorta el
icono con formas distintas según el lanzador y solo garantiza visible el 80 %
central, así que un icono a tamaño completo pierde los extremos.

El service worker solo se registra en compilaciones de producción. En desarrollo,
uno interceptando peticiones convierte cada cambio en una duda sobre si lo que
se ve es el código nuevo o una copia guardada.

### La regla del caché

**Nunca servir una respuesta guardada como si fuera fresca.** En un punto de
venta un precio viejo se cobra mal y un total viejo descuadra la caja.

- Las **escrituras no se interceptan jamás**. Una venta llega al servidor o falla
  de forma visible; guardarla para «enviarla luego» es dinero perdido.
- Las **lecturas** van primero a la red y solo recurren a la copia sin conexión,
  marcándola con una cabecera.
- Los **recursos compilados** llevan hash: se sirven de la copia sin preguntar.
- **No se llama a `skipWaiting()`**: una versión nueva espera a que se cierren
  las pestañas abiertas. Reemplazar el código a mitad de una venta es justo lo
  que no debe pasar en una caja.

`sw.js` se sirve con `no-store`. Un service worker cacheado sigue entregando la
versión anterior para siempre: es el fallo clásico de las PWA.

### Adaptación

![Prueba en múltiples dispositivos](../docs/screenshots/prueba-responsive.png)

Probado en simulador sobre once dispositivos reales, desde un Galaxy Fold
plegado (280 px) hasta un MacBook Pro (1440 px), y verificado además midiendo el
desbordamiento horizontal en **11 anchos × 5 pantallas**, de 280 a 1920 px: sin
desbordes en ninguna combinación.

| Rango | Comportamiento |
|---|---|
| < 600 px | Menú colapsable, filtros apilados, campos sin ancho mínimo |
| 600–1279 px | Rejillas de una columna |
| ≥ 1280 px | Dos columnas en tablero y reportes |

Las tres causas reales que hubo que corregir:

- **Las tablas empujaban la página entera**, y con ella se descuadraban barra
  lateral y cabecera. Ahora se desplazan dentro de su propio contenedor
  (`.table-scroll`).
- **Las rejillas usaban `1fr`**, que equivale a `minmax(auto, 1fr)`: un mínimo
  automático deja que el contenido estire la columna. Con `minmax(0, 1fr)` sí
  encogen.
- **Dos campos de fecha** sumaban más ancho mínimo que una pantalla de 360 px.

Además: áreas táctiles de **44 px** (WCAG 2.5.5), campos a **16 px** en móvil
—Safari amplía la página al enfocar un campo menor y luego no la devuelve— y
márgenes seguros con `env(safe-area-inset-*)` para que la barra de gestos de un
iPhone no tape el botón de cobrar.

El foco de teclado es visible en todos los controles: contorno verde de 2 px.

---

## Pruebas

**106 pruebas** en 10 suites con Vitest y Vue Test Utils.

```bash
npm test
```

Cubren el panel de venta, el catálogo, los diálogos de alta, el filtrado de
importes, la codificación EAN-13, el cliente HTTP y el tema por defecto.

---

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build para revisarlo |
| `npm test` | Pruebas de componentes |
| `npm run lint` | ESLint |

### Variables de entorno

| Variable | Notas |
|---|---|
| `VITE_API_BASE_URL` | Obligatoria en producción. Ya fijada en `.env.production` |
| `VITE_API_PROXY_TARGET` | Solo desarrollo, si la API no está en el puerto 3000 |
| `VITE_SHOW_DEMO_ACCOUNTS` | Muestra los atajos con credenciales. **Dejar sin definir en cualquier despliegue real** |

Se resuelven **al compilar**, no en tiempo de ejecución: cambiar la URL de la
API exige recompilar y volver a desplegar, no basta con tocar una variable en el
hosting.

### Nota sobre `usePolling`

El servidor de desarrollo usa sondeo en lugar de eventos del sistema de
archivos. Cuando el proyecto vive en una ruta de Windows montada en WSL
(`/mnt/c`), el sistema 9p no emite eventos inotify y la recarga en caliente deja
de funcionar **en silencio**: se edita un archivo y el navegador nunca se entera.
