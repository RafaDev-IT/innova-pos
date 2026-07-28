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
              @error="notify($event, 'error')"
            />
          </v-col>

          <!-- Columna de venta: carrito, edición de precios y total. -->
          <v-col cols="12" md="5">
            <SalePanel
              ref="salePanel"
              @saved="onSaleSaved"
              @error="notify($event, 'error')"
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

export default {
  name: 'App',

  components: { ProductCatalog, SalePanel },

  data: () => ({
    apiOnline: false,
    notification: {
      visible: false,
      message: '',
      color: 'success',
    },
  }),

  created() {
    this.checkApiHealth();
  },

  methods: {
    async checkApiHealth() {
      try {
        await http.get('/health');
        this.apiOnline = true;
      } catch (error) {
        this.apiOnline = false;
        this.notify(error.message, 'error');
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
