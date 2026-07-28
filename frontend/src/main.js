import Vue from 'vue';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import registerServiceWorker from './registerServiceWorker';

Vue.config.productionTip = false;

new Vue({
  router,
  vuetify,
  render: (h) => h(App),
}).$mount('#app');

// Se registra después de montar: la aplicación debe pintar cuanto antes, y el
// service worker no aporta nada en la primera visita.
registerServiceWorker();
