import Vue from 'vue';
import Vuetify from 'vuetify';

// Vuetify 2 debe instalarse en el Vue global antes de montar cualquier
// componente en los tests; de lo contrario los `v-*` no se resuelven.
Vue.use(Vuetify);

// jsdom no implementa estas APIs y Vuetify las consulta al montar overlays.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// Silencia el aviso de Vuetify sobre el data-app faltante en los tests.
const appEl = document.createElement('div');
appEl.setAttribute('data-app', 'true');
document.body.appendChild(appEl);
