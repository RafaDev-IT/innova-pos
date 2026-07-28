<template>
  <div class="pos-panel">
    <header class="pos-panel__head">
      <v-icon size="18" color="primary">mdi-package-variant-closed</v-icon>
      <span class="pos-panel__title">Catálogo</span>
      <span v-if="pagination.total" class="pos-count">{{ pagination.total }}</span>
      <v-spacer />
      <v-btn depressed class="pos-btn-primary" @click="openCreateDialog">
        <v-icon left size="18">mdi-plus</v-icon>
        Agregar producto
      </v-btn>
    </header>

    <div class="pos-search-wrap">
      <v-text-field
        ref="searchField"
        v-model="query"
        class="pos-search"
        placeholder="Escanea un código o escribe el nombre del producto…"
        solo
        flat
        dense
        clearable
        hide-details
        autofocus
        prepend-inner-icon="mdi-magnify"
        :loading="loading"
        @keydown.enter="handleEnter"
        @click:clear="onQueryChange('')"
      />
    </div>

    <div class="pos-hint">
      <v-icon size="13">mdi-barcode-scan</v-icon>
      Escanea y presiona <kbd class="pos-kbd">Enter</kbd> para agregar directo a la venta
    </div>

    <div class="pos-panel__body pos-scroll">
      <v-alert v-if="errorMessage" type="error" dense text class="ma-4">
        {{ errorMessage }}
      </v-alert>

      <v-skeleton-loader v-else-if="loading && !products.length" type="list-item-two-line@5" class="pa-2" />

      <template v-else-if="products.length">
        <div
          v-for="product in products"
          :key="product.id"
          class="pos-row"
          role="button"
          tabindex="0"
          :title="`Agregar ${product.name} a la venta`"
          @click="addToSale(product)"
          @keydown.enter.self="addToSale(product)"
        >
          <div class="pos-row__main">
            <div class="pos-row__name">{{ product.name }}</div>
            <div class="pos-row__meta">
              <span class="pos-barcode">{{ product.barcode }}</span>
              <span v-if="product.description" class="pos-row__desc">· {{ product.description }}</span>
            </div>
          </div>

          <div class="pos-row__price">{{ formatCurrency(product.price) }}</div>

          <div class="pos-row__actions">
            <v-btn icon small title="Editar producto" @click.stop="openEditDialog(product)">
              <v-icon size="17">mdi-pencil-outline</v-icon>
            </v-btn>
            <v-btn icon small title="Dar de baja" @click.stop="confirmDelete(product)">
              <v-icon size="17">mdi-trash-can-outline</v-icon>
            </v-btn>
            <v-btn icon small color="primary" title="Agregar a la venta" @click.stop="addToSale(product)">
              <v-icon size="20">mdi-plus-circle</v-icon>
            </v-btn>
          </div>
        </div>
      </template>

      <div v-else class="pos-empty">
        <div class="pos-empty__icon">
          <v-icon size="26" color="grey">{{ query ? 'mdi-magnify-close' : 'mdi-package-variant' }}</v-icon>
        </div>
        <div class="pos-empty__title">
          {{ query ? 'Sin coincidencias' : 'El catálogo está vacío' }}
        </div>
        <div class="pos-empty__hint">
          {{
            query
              ? `Ningún producto coincide con "${query}". Revisa el texto o registra el producto.`
              : 'Registra tu primer producto para empezar a vender. Solo necesitas nombre, código de barras y precio.'
          }}
        </div>
        <v-btn v-if="query" text small color="primary" class="mt-3" @click="onQueryChange('')">
          Limpiar búsqueda
        </v-btn>
        <v-btn v-else depressed small class="pos-btn-primary mt-3" @click="openCreateDialog">
          <v-icon left size="16">mdi-plus</v-icon>
          Agregar producto
        </v-btn>
      </div>
    </div>

    <footer v-if="pagination.hasMore" class="pos-panel__foot">
      <v-btn text small color="primary" :loading="loadingMore" @click="loadMore">
        Cargar más · {{ products.length }} de {{ pagination.total }}
      </v-btn>
    </footer>

    <ProductFormDialog v-model="dialogOpen" :product="editingProduct" @saved="onProductSaved" />

    <v-dialog v-model="deleteDialog.open" max-width="430">
      <div class="v-card pos-dialog">
        <div class="pos-dialog__head">
          <div class="pos-dialog__icon pos-dialog__icon--danger">
            <v-icon size="19" color="error">mdi-trash-can-outline</v-icon>
          </div>
          <span class="pos-dialog__title">Dar de baja producto</span>
        </div>
        <div class="pos-dialog__body">
          <p class="pos-dialog__text mb-2">
            <strong>{{ deleteDialog.product && deleteDialog.product.name }}</strong>
            dejará de aparecer en el catálogo y no podrá agregarse a nuevas ventas.
          </p>
          <p class="pos-dialog__note mb-0">
            Las ventas ya registradas lo conservan intacto, con el precio al que se cobró.
          </p>
        </div>
        <div class="pos-dialog__foot">
          <v-spacer />
          <v-btn text @click="deleteDialog.open = false">Cancelar</v-btn>
          <v-btn color="error" depressed :loading="deleteDialog.saving" @click="performDelete">
            Dar de baja
          </v-btn>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script>
import productService from '@/services/productService';
import ProductFormDialog from '@/components/ProductFormDialog.vue';
import { formatCurrency } from '@/utils/format';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

export default {
  name: 'ProductCatalog',

  components: { ProductFormDialog },

  data: () => ({
    query: '',
    products: [],
    pagination: { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false },
    loading: false,
    loadingMore: false,
    errorMessage: '',
    dialogOpen: false,
    editingProduct: null,
    deleteDialog: { open: false, product: null, saving: false },
    debounceTimer: null,
    // Descarta respuestas de búsquedas obsoletas que lleguen fuera de orden.
    requestId: 0,
  }),

  watch: {
    query(value) {
      this.onQueryChange(value);
    },
  },

  created() {
    this.fetchProducts();
  },

  beforeDestroy() {
    clearTimeout(this.debounceTimer);
  },

  methods: {
    formatCurrency,

    /** Devuelve el cursor al buscador (atajo F2). */
    focusSearch() {
      const field = this.$refs.searchField;
      if (field && typeof field.focus === 'function') field.focus();
    },

    /**
     * Espera a que el usuario deje de teclear antes de consultar. Sin esto una
     * búsqueda de 10 caracteres dispara 10 peticiones al backend.
     */
    onQueryChange(value) {
      if (this.query !== value) this.query = value;
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.fetchProducts(), DEBOUNCE_MS);
    },

    async fetchProducts({ append = false } = {}) {
      const currentRequest = ++this.requestId;
      if (append) this.loadingMore = true;
      else this.loading = true;
      this.errorMessage = '';

      try {
        const { items, pagination } = await productService.search({
          query: (this.query || '').trim(),
          limit: PAGE_SIZE,
          offset: append ? this.products.length : 0,
        });

        // Si mientras tanto se lanzó otra búsqueda, esta respuesta ya no aplica.
        if (currentRequest !== this.requestId) return;

        this.products = append ? [...this.products, ...items] : items;
        this.pagination = pagination;
      } catch (error) {
        if (currentRequest !== this.requestId) return;
        this.errorMessage = error.message;
        this.$emit('error', error);
      } finally {
        if (currentRequest === this.requestId) {
          this.loading = false;
          this.loadingMore = false;
        }
      }
    },

    loadMore() {
      this.fetchProducts({ append: true });
    },

    /**
     * Flujo de pistola lectora: el escáner teclea el código y envía Enter.
     * Si hay una coincidencia exacta de código de barras se agrega directo a la
     * venta y el campo queda listo para el siguiente artículo.
     */
    handleEnter() {
      clearTimeout(this.debounceTimer);
      const term = (this.query || '').trim();
      if (!term) return;

      const exact = this.products.find((p) => p.barcode === term);
      if (exact) {
        this.addToSale(exact);
        this.query = '';
        return;
      }

      if (this.products.length === 1) {
        this.addToSale(this.products[0]);
        this.query = '';
        return;
      }

      this.fetchProducts();
    },

    addToSale(product) {
      this.$emit('add-to-sale', product);
    },

    openCreateDialog() {
      this.editingProduct = null;
      this.dialogOpen = true;
    },

    openEditDialog(product) {
      this.editingProduct = product;
      this.dialogOpen = true;
    },

    onProductSaved(product, wasEditing) {
      this.$emit('notify', wasEditing ? 'Producto actualizado' : `"${product.name}" agregado al catálogo`);
      this.$emit('product-updated', product);
      this.fetchProducts();
    },

    confirmDelete(product) {
      this.deleteDialog = { open: true, product, saving: false };
    },

    async performDelete() {
      this.deleteDialog.saving = true;
      try {
        await productService.remove(this.deleteDialog.product.id);
        this.$emit('notify', 'Producto dado de baja');
        this.deleteDialog.open = false;
        this.fetchProducts();
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.deleteDialog.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.pos-search-wrap {
  padding: 12px 16px 0;
}

.pos-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pos-text-faint);
  background: var(--pos-surface-sunken);
  border: 1px solid var(--pos-border);
  border-radius: 999px;
  padding: 1px 8px;
}

.pos-row__desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pos-panel__foot {
  border-top: 1px solid var(--pos-border);
  text-align: center;
  padding: 6px;
}

.pos-dialog__text {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--pos-text);
}
.pos-dialog__note {
  font-size: 0.8125rem;
  color: var(--pos-text-faint);
  line-height: 1.5;
}
</style>
