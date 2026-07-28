import Vue from 'vue';
// Se usa el bundle precompilado (`vuetify`) y no `vuetify/lib`: este último
// importa los fuentes .sass de cada componente, que exigen sass ~1.32 —una
// versión que arrastra incompatibilidades con Node moderno—. Con el bundle el
// proyecto compila sin toolchain de SASS a cambio de renunciar al tree-shaking,
// intercambio razonable para una aplicación de una sola pantalla.
import Vuetify from 'vuetify';

import 'vuetify/dist/vuetify.min.css';
import '@mdi/font/css/materialdesignicons.css';
// Los tokens propios se cargan después de Vuetify para poder sobrescribir sus
// valores por defecto sin pelear con la especificidad.
import '@/styles/design-system.css';

Vue.use(Vuetify);

/**
 * Paleta.
 *
 * Verde como único acento —precios, elemento activo y acción principal— y ámbar
 * reservado en exclusiva para señalar un precio ajustado dentro de la venta: un
 * color, un significado. Los pares texto/fondo cumplen contraste AA de WCAG.
 */
const light = {
  primary: '#12A150',
  secondary: '#1A2027',
  accent: '#D97706',
  error: '#DC2626',
  warning: '#D97706',
  info: '#0284C7',
  success: '#12A150',
};

const dark = {
  primary: '#2ECC71',
  secondary: '#E8EDF3',
  accent: '#F0A44A',
  error: '#F0655A',
  warning: '#F0A44A',
  info: '#38BDF8',
  success: '#2ECC71',
};

export const THEME_STORAGE_KEY = 'innova-pos:theme';

/**
 * Arranca en el tema que el usuario eligió la última vez; si nunca eligió,
 * respeta la preferencia del sistema. Muchos comercios operan de noche con
 * poca luz ambiental, y forzar el tema claro deslumbra.
 */
function prefersDark() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch (error) {
    // localStorage puede estar bloqueado; se cae a la preferencia del sistema.
  }
  return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export default new Vuetify({
  icons: { iconfont: 'mdi' },
  theme: {
    dark: prefersDark(),
    options: { customProperties: true },
    themes: { light, dark },
  },
});
