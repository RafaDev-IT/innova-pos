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
 * Paleta "Terminal de trabajo".
 *
 * Teal profundo en lugar del azul corporativo por defecto, y ámbar reservado
 * exclusivamente para señalar un precio ajustado dentro de la venta: un color,
 * un significado. Los pares texto/fondo cumplen contraste AA de WCAG, y la
 * cifra del total alcanza AAA.
 */
const light = {
  primary: '#0F766E',
  secondary: '#131C2B',
  accent: '#B45309',
  error: '#B3261E',
  warning: '#B45309',
  info: '#0369A1',
  success: '#15803D',
};

const dark = {
  primary: '#2DD4BF',
  secondary: '#E8EEF7',
  accent: '#F0A44A',
  error: '#F2685C',
  warning: '#F0A44A',
  info: '#38BDF8',
  success: '#4ADE80',
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
