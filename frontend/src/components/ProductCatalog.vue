<template>
  <div class="panel">
    <div class="catalog__toolbar">
      <v-text-field
        ref="searchField"
        v-model="query"
        class="field-pill flex-grow-1"
        placeholder="Buscar producto o escanear código…"
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

      <v-btn
        depressed
        class="btn-surface ml-3"
        title="Escanear con la cámara"
        @click="scannerAbierto = true"
      >
        <v-icon size="21">mdi-barcode-scan</v-icon>
      </v-btn>

      <v-btn depressed class="btn-primary ml-2 btn-tall px-5" @click="openCreateDialog">
        <v-icon left size="19">mdi-plus</v-icon>
        Producto
      </v-btn>
    </div>

    <div class="catalog__hint">
      <v-icon size="13">mdi-barcode-scan</v-icon>
      Escanea y presiona <kbd class="kbd mx-1">Enter</kbd> para agregar directo a la venta
      <v-spacer />
      <span v-if="pagination.total" class="chip-soft">{{ pagination.total }} productos</span>
    </div>

    <div class="panel__body scroll px-4 pb-4">
      <v-alert v-if="errorMessage" type="error" dense text class="mb-4">{{ errorMessage }}</v-alert>

      <div v-else-if="loading && !products.length" class="catalog__grid">
        <v-skeleton-loader v-for="n in 8" :key="n" type="image, list-item-two-line" class="card" />
      </div>

      <div v-else-if="products.length" class="catalog__grid">
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :product="product"
          :quantity="quantities[product.id] || 0"
          @add="$emit('add-to-sale', $event)"
          @increase="$emit('add-to-sale', $event)"
          @decrease="$emit('decrease-in-sale', $event)"
          @edit="openEditDialog"
          @remove="confirmDelete"
        />
      </div>

      <div v-else class="empty">
        <div class="empty__icon">
          <v-icon size="28" color="primary">{{ query ? 'mdi-magnify-close' : 'mdi-package-variant' }}</v-icon>
        </div>
        <div class="empty__title">{{ query ? 'Sin coincidencias' : 'El catálogo está vacío' }}</div>
        <div class="empty__hint">
          {{
            query
              ? `Ningún producto coincide con "${query}".`
              : 'Registra tu primer producto para empezar a vender.'
          }}
        </div>
        <v-btn v-if="query" text small color="primary" class="mt-3" @click="onQueryChange('')">
          Limpiar búsqueda
        </v-btn>
        <v-btn v-else depressed small class="btn-primary mt-4 px-5" @click="openCreateDialog">
          <v-icon left size="16">mdi-plus</v-icon>
          Agregar producto
        </v-btn>
      </div>

      <div v-if="pagination.hasMore" class="text-center pt-4">
        <v-btn text small color="primary" :loading="loadingMore" @click="loadMore">
          Cargar más · {{ products.length }} de {{ pagination.total }}
        </v-btn>
      </div>
    </div>

    <ProductFormDialog v-model="dialogOpen" :product="editingProduct" @saved="onProductSaved" />

    <BarcodeScanner v-model="scannerAbierto" @scanned="onEscaneado" />

    <v-dialog v-model="deleteDialog.open" max-width="430">
      <div class="dialog">
        <div class="dialog__head">
          <div class="dialog__icon dialog__icon--danger">
            <v-icon size="20" color="error">mdi-trash-can-outline</v-icon>
          </div>
          <div>
            <div class="dialog__title">Dar de baja producto</div>
            <div class="dialog__sub">Dejará de aparecer en el catálogo</div>
          </div>
        </div>
        <div class="dialog__body">
          <p class="dialog__text mb-2">
            <strong>{{ deleteDialog.product && deleteDialog.product.name }}</strong> no podrá agregarse a nuevas
            ventas.
          </p>
          <p class="dialog__note mb-0">
            Las ventas ya registradas lo conservan intacto, con el precio al que se cobró.
          </p>
        </div>
        <div class="dialog__foot">
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
import ProductCard from '@/components/ProductCard.vue';
import BarcodeScanner from '@/components/BarcodeScanner.vue';

const PAGE_SIZE = 24;
const DEBOUNCE_MS = 300;

export default {
  name: 'ProductCatalog',

  components: { ProductFormDialog, ProductCard, BarcodeScanner },

  props: {
    /** Unidades por producto ya presentes en la venta, indexadas por id. */
    quantities: { type: Object, default: () => ({}) },
  },

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
    scannerAbierto: false,
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

    /**
     * Código leído con la cámara. Se busca y, si hay coincidencia exacta, se
     * agrega directo a la venta: es el mismo gesto que con una pistola lectora.
     */
    async onEscaneado(codigo) {
      this.query = codigo;
      clearTimeout(this.debounceTimer);
      await this.fetchProducts();

      const exacto = this.products.find((p) => p.barcode === codigo);
      if (exacto) {
        this.addToSale(exacto);
        this.query = '';
        return;
      }

      this.$emit('notify', `No hay ningún producto con el código ${codigo}`);
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
.catalog__toolbar {
  display: flex;
  align-items: center;
  padding: 16px 16px 8px;
  flex: 0 0 auto;
}

.catalog__hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--pos-text-faint);
  padding: 4px 20px 12px;
  flex: 0 0 auto;
}

/* Rejilla fluida: tantas columnas como quepan sin bajar de 168 px de ancho,
   para que la tarjeta siga siendo legible en tablet. */
.catalog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 14px;
}

.dialog__text {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--pos-text);
}
.dialog__note {
  font-size: 0.8125rem;
  color: var(--pos-text-faint);
  line-height: 1.5;
}
</style>
