<template>
  <v-container fluid class="pa-4 pos-shell">
    <v-row class="pos-grid">
      <!-- Catálogo: búsqueda y alta de productos. -->
      <v-col cols="12" md="7" class="pos-grid__col">
        <ProductCatalog
          ref="catalog"
          @add-to-sale="onAddToSale"
          @notify="$emit('notify', $event)"
          @error="$emit('error', $event)"
        />
      </v-col>

      <!-- Venta: carrito, edición de precios y total. -->
      <v-col cols="12" md="5" class="pos-grid__col">
        <SalePanel ref="salePanel" @saved="onSaleSaved" @error="$emit('error', $event)" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import ProductCatalog from '@/components/ProductCatalog.vue';
import SalePanel from '@/components/SalePanel.vue';

export default {
  name: 'PosView',

  components: { ProductCatalog, SalePanel },

  mounted() {
    window.addEventListener('keydown', this.onGlobalKey);
  },

  beforeDestroy() {
    window.removeEventListener('keydown', this.onGlobalKey);
  },

  methods: {
    /**
     * Atajos de la pantalla de venta. Se registran y se retiran con la vista,
     * de modo que no interfieran en las demás pantallas.
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

    /**
     * El catálogo solo anuncia qué producto se eligió; el panel de venta decide
     * cómo incorporarlo al carrito.
     */
    onAddToSale(product) {
      this.$refs.salePanel.addProduct(product);
    },

    onSaleSaved(sale) {
      this.$emit('notify', `Venta ${sale.folio} registrada`);
    },
  },
};
</script>

<style scoped>
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
</style>
