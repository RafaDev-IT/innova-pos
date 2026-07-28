<template>
  <v-app>
    <v-app-bar app color="primary" dark flat height="60">
      <v-icon large class="mr-3">mdi-point-of-sale</v-icon>
      <v-toolbar-title class="text-h6 font-weight-bold">Innova POS</v-toolbar-title>
      <v-spacer />
      <v-chip small outlined :color="apiOnline ? 'white' : 'error'">
        <v-icon left small>{{ apiOnline ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
        {{ apiOnline ? 'API conectada' : 'API sin conexión' }}
      </v-chip>
    </v-app-bar>

    <v-main class="grey lighten-4">
      <v-container fluid class="pa-4">
        <v-row>
          <!-- Columna de catálogo: búsqueda y alta de productos. -->
          <v-col cols="12" md="7">
            <ProductCatalog
              @add-to-sale="onAddToSale"
              @notify="notify($event)"
              @error="onModuleError($event)"
            />
          </v-col>

          <!-- Columna de venta: carrito, edición de precios y total. -->
          <v-col cols="12" md="5">
            <SalePanel
              ref="salePanel"
              @saved="onSaleSaved"
              @error="onModuleError($event)"
            />
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <v-snackbar v-model="notification.visible" :color="notification.color" :timeout="4000" bottom right>
      {{ notification.message }}
      <template #action="{ attrs }">
        <v-btn text v-bind="attrs" @click="notification.visible = false">Cerrar</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script>
import http from '@/services/http';
import ProductCatalog from '@/components/ProductCatalog.vue';
import SalePanel from '@/components/SalePanel.vue';

const HEALTH_INTERVAL_MS = 15000;

export default {
  name: 'App',

  components: { ProductCatalog, SalePanel },

  data: () => ({
    apiOnline: false,
    healthTimer: null,
    notification: {
      visible: false,
      message: '',
      color: 'success',
    },
  }),

  created() {
    this.checkApiHealth({ silent: true });
    // El indicador se revalida periódicamente: comprobarlo solo al arrancar
    // haría que siguiera anunciando "API conectada" después de que la API
    // cayera, afirmando un estado que no se verificó.
    this.healthTimer = setInterval(() => this.checkApiHealth({ silent: true }), HEALTH_INTERVAL_MS);
  },

  beforeDestroy() {
    clearInterval(this.healthTimer);
  },

  methods: {
    async checkApiHealth({ silent = false } = {}) {
      const estabaEnLinea = this.apiOnline;
      try {
        await http.get('/health');
        this.apiOnline = true;
        // Solo se avisa de la recuperación, no de cada sondeo correcto.
        if (!estabaEnLinea && !silent) this.notify('Conexión con la API restablecida');
      } catch (error) {
        this.apiOnline = false;
        if (!silent) this.notify(error.message, 'error');
      }
    },

    /**
     * Un módulo reportó un fallo. Si fue de conexión se revalida el estado de
     * la API de inmediato, sin esperar al siguiente sondeo.
     */
    onModuleError(error) {
      const message = typeof error === 'string' ? error : error.message;
      this.notify(message, 'error');

      const esDeConexion = typeof error === 'object' && error !== null && error.offline;
      if (esDeConexion || /no se pudo conectar/i.test(message)) {
        this.apiOnline = false;
        this.checkApiHealth({ silent: true });
      }
    },

    /** Punto único de notificaciones: los módulos hijos emiten hacia aquí. */
    notify(message, color = 'success') {
      this.notification = { visible: true, message, color };
    },

    /**
     * El catálogo solo anuncia qué producto se eligió; el panel de venta es
     * quien decide cómo incorporarlo al carrito. Así el catálogo no necesita
     * conocer la estructura de la venta.
     */
    onAddToSale(product) {
      this.$refs.salePanel.addProduct(product);
      this.notify(`"${product.name}" agregado a la venta`);
    },

    onSaleSaved(sale) {
      this.notify(`Venta ${sale.folio} registrada por ${sale.total}`);
    },
  },
};
</script>

<style>
html {
  overflow-y: auto;
}
</style>
