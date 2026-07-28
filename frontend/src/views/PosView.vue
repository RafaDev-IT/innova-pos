<template>
  <div class="pos-layout">
    <!-- Catálogo: búsqueda y rejilla de productos. -->
    <div class="pos-layout__main">
      <ProductCatalog
        ref="catalog"
        :quantities="quantities"
        @add-to-sale="onAddToSale"
        @decrease-in-sale="onDecreaseInSale"
        @notify="$emit('notify', $event)"
        @error="$emit('error', $event)"
      />
    </div>

    <!-- Venta: renglones, total y cobro. -->
    <aside class="pos-layout__aside">
      <SalePanel
        ref="salePanel"
        @cart-changed="quantities = $event"
        @saved="onSaleSaved"
        @error="$emit('error', $event)"
      />
    </aside>
  </div>
</template>

<script>
import ProductCatalog from '@/components/ProductCatalog.vue';
import SalePanel from '@/components/SalePanel.vue';

export default {
  name: 'PosView',

  components: { ProductCatalog, SalePanel },

  data: () => ({
    /** Unidades por producto en la venta, para el contador de cada tarjeta. */
    quantities: {},
  }),

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

    onDecreaseInSale(product) {
      this.$refs.salePanel.decreaseProduct(product);
    },

    onSaleSaved(sale) {
      this.$emit('notify', `Venta ${sale.folio} registrada`);
    },
  },
};
</script>

<style scoped>
/* Dos columnas de altura completa que hacen scroll por dentro: el total y el
   botón de cobro nunca quedan fuera de la vista. */
.pos-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 16px;
  padding: 16px;
  height: calc(100vh - 64px);
}

.pos-layout__main,
.pos-layout__aside {
  min-height: 0;
  display: flex;
}
.pos-layout__main > *,
.pos-layout__aside > * {
  flex: 1 1 auto;
  min-width: 0;
}

@media (max-width: 1279px) {
  .pos-layout {
    grid-template-columns: minmax(0, 1fr) 330px;
  }
}

@media (max-width: 959px) {
  .pos-layout {
    grid-template-columns: 1fr;
    height: auto;
  }
  .pos-layout__main,
  .pos-layout__aside {
    min-height: 460px;
  }
}
</style>
