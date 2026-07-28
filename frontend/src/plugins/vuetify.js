import Vue from 'vue';
// Se usa el bundle precompilado (`vuetify`) y no `vuetify/lib`: este último
// importa los fuentes .sass de cada componente, que exigen sass ~1.32 —una
// versión que arrastra incompatibilidades con Node moderno—. Con el bundle el
// proyecto compila sin toolchain de SASS a cambio de renunciar al tree-shaking,
// intercambio razonable para una aplicación de una sola pantalla.
import Vuetify from 'vuetify';

import 'vuetify/dist/vuetify.min.css';
import '@mdi/font/css/materialdesignicons.css';

Vue.use(Vuetify);

export default new Vuetify({
  icons: {
    iconfont: 'mdi',
  },
  theme: {
    options: { customProperties: true },
    themes: {
      light: {
        primary: '#1565C0',
        secondary: '#37474F',
        accent: '#00897B',
        error: '#C62828',
        warning: '#EF6C00',
        info: '#0277BD',
        success: '#2E7D32',
      },
    },
  },
});
