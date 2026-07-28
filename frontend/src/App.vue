<template>
  <v-app>
    <v-app-bar app flat height="56" class="pos-appbar">
      <div class="pos-brand-mark mr-3">
        <v-icon size="18" color="white">mdi-point-of-sale</v-icon>
      </div>
      <span class="pos-brand">Innova POS</span>

      <v-spacer />

      <div class="d-none d-md-flex align-center mr-4" style="gap: 14px">
        <span class="pos-shortcut-hint"><kbd class="pos-kbd">F2</kbd> Buscar</span>
        <span class="pos-shortcut-hint"><kbd class="pos-kbd">F9</kbd> Guardar venta</span>
      </div>

      <div
        class="pos-status mr-2"
        :class="apiOnline ? 'pos-status--online' : 'pos-status--offline'"
        :title="apiOnline ? 'La API responde correctamente' : 'Sin respuesta de la API'"
      >
        <span class="pos-status__dot" />
        <v-icon size="13" :color="apiOnline ? 'success' : 'error'">
          {{ apiOnline ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline' }}
        </v-icon>
        {{ apiOnline ? 'En línea' : 'Sin conexión' }}
      </div>

      <v-btn icon dark :title="isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'" @click="toggleTheme">
        <v-icon size="20">{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4 pos-shell">
        <v-row class="pos-grid">
          <!-- Catálogo: búsqueda y alta de productos. -->
          <v-col cols="12" md="7" class="pos-grid__col">
            <ProductCatalog
              ref="catalog"
              @add-to-sale="onAddToSale"
              @notify="notify($event)"
              @error="onModuleError($event)"
            />
          </v-col>

          <!-- Venta: carrito, edición de precios y total. -->
          <v-col cols="12" md="5" class="pos-grid__col">
            <SalePanel ref="salePanel" @saved="onSaleSaved" @error="onModuleError($event)" />
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <v-snackbar v-model="notification.visible" :color="notification.color" :timeout="3600" bottom right>
      <div class="d-flex align-center">
        <v-icon small dark class="mr-2">{{ notificationIcon }}</v-icon>
        {{ notification.message }}
      </div>
      <template #action="{ attrs }">
        <v-btn text small v-bind="attrs" @click="notification.visible = false">Cerrar</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script>
import http from '@/services/http';
import ProductCatalog from '@/components/ProductCatalog.vue';
import SalePanel from '@/components/SalePanel.vue';
import { THEME_STORAGE_KEY } from '@/plugins/vuetify';

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

  computed: {
    isDark() {
      return this.$vuetify.theme.dark;
    },

    notificationIcon() {
      return { success: 'mdi-check-circle', error: 'mdi-alert-circle', info: 'mdi-information' }[
        this.notification.color
      ];
    },
  },

  created() {
    this.checkApiHealth({ silent: true });
    // El indicador se revalida periódicamente: comprobarlo solo al arrancar
    // haría que siguiera anunciando "En línea" después de que la API cayera,
    // afirmando un estado que no se verificó.
    this.healthTimer = setInterval(() => this.checkApiHealth({ silent: true }), HEALTH_INTERVAL_MS);
  },

  mounted() {
    window.addEventListener('keydown', this.onGlobalKey);
  },

  beforeDestroy() {
    clearInterval(this.healthTimer);
    window.removeEventListener('keydown', this.onGlobalKey);
  },

  methods: {
    /**
     * Atajos globales. El flujo completo de una venta debe poder hacerse sin
     * soltar el teclado: escanear, Enter, escanear, Enter, F9.
     */
    onGlobalKey(event) {
      if (event.key === 'F2') {
        event.preventDefault();
        this.$refs.catalog.focusSearch();
      } else if (event.key === 'F9') {
        event.preventDefault();
        this.$refs.salePanel.save();
      }
    },

    toggleTheme() {
      this.$vuetify.theme.dark = !this.$vuetify.theme.dark;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, this.$vuetify.theme.dark ? 'dark' : 'light');
      } catch (error) {
        // Sin localStorage el tema simplemente no persiste entre sesiones.
      }
    },

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

    /** Punto único de notificaciones: los módulos hijos emiten hacia aquí. */
    notify(message, color = 'success') {
      this.notification = { visible: true, message, color };
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

    /**
     * El catálogo solo anuncia qué producto se eligió; el panel de venta es
     * quien decide cómo incorporarlo al carrito. Así el catálogo no necesita
     * conocer la estructura de la venta.
     */
    onAddToSale(product) {
      this.$refs.salePanel.addProduct(product);
    },

    onSaleSaved(sale) {
      this.notify(`Venta ${sale.folio} registrada`);
    },
  },
};
</script>

<style>
html {
  overflow-y: auto;
}

.pos-shell {
  max-width: 1800px;
}

/* Las dos columnas comparten altura y hacen scroll por dentro, de modo que el
   total nunca queda fuera de la vista. La separación se deja a los gutters de
   Vuetify: sumar un `gap` propio a columnas que ya ocupan el 100% desborda el
   viewport horizontalmente. */
.pos-grid {
  flex-wrap: nowrap;
}
.pos-grid__col {
  height: calc(100vh - 88px);
  min-height: 520px;
  display: flex;
}
.pos-grid__col > * {
  flex: 1 1 auto;
  min-width: 0;
}

@media (max-width: 959px) {
  .pos-grid {
    flex-wrap: wrap;
  }
  .pos-grid__col {
    height: auto;
    min-height: 0;
  }
}

.pos-shortcut-hint {
  font-size: 0.75rem;
  color: var(--pos-on-ink-muted);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.pos-shortcut-hint .pos-kbd {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
  color: #cbd5e1;
}
</style>
