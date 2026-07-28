<template>
  <v-card outlined class="d-flex flex-column fill-height">
    <v-card-title class="pb-2">
      <v-icon left color="primary">mdi-package-variant-closed</v-icon>
      <span class="text-subtitle-1 font-weight-bold">Catálogo de productos</span>
      <v-spacer />
      <v-btn color="primary" depressed @click="openCreateDialog">
        <v-icon left>mdi-plus</v-icon>
        Agregar producto
      </v-btn>
    </v-card-title>

    <v-card-subtitle class="pb-0">
      <v-text-field
        ref="searchField"
        v-model="query"
        label="Buscar por nombre o código de barras"
        placeholder="Escanea o escribe para buscar…"
        outlined
        dense
        clearable
        hide-details
        autofocus
        prepend-inner-icon="mdi-magnify"
        :loading="loading"
        @keydown.enter="handleEnter"
        @click:clear="onQueryChange('')"
      />
      <div class="text-caption grey--text mt-1 mb-2">
        <v-icon x-small>mdi-information-outline</v-icon>
        Con un código de barras exacto, presiona <strong>Enter</strong> para agregarlo directo a la venta.
      </div>
    </v-card-subtitle>

    <v-divider />

    <div class="catalog-results">
      <v-alert v-if="errorMessage" type="error" dense text class="ma-4">
        {{ errorMessage }}
      </v-alert>

      <v-skeleton-loader v-else-if="loading && !products.length" type="list-item-two-line@4" class="pa-2" />

      <v-list v-else-if="products.length" two-line class="py-0">
        <template v-for="(product, index) in products">
          <v-list-item :key="product.id" @click="addToSale(product)">
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium">{{ product.name }}</v-list-item-title>
              <v-list-item-subtitle>
                <v-icon x-small>mdi-barcode</v-icon>
                {{ product.barcode }}
                <span v-if="product.description" class="ml-2">· {{ product.description }}</span>
              </v-list-item-subtitle>
            </v-list-item-content>

            <v-list-item-action class="flex-row align-center">
              <span class="text-subtitle-1 font-weight-bold primary--text mr-4">
                {{ formatCurrency(product.price) }}
              </span>

              <v-tooltip bottom>
                <template #activator="{ on, attrs }">
                  <v-btn icon small v-bind="attrs" v-on="on" @click.stop="openEditDialog(product)">
                    <v-icon small>mdi-pencil</v-icon>
                  </v-btn>
                </template>
                <span>Editar producto</span>
              </v-tooltip>

              <v-tooltip bottom>
                <template #activator="{ on, attrs }">
                  <v-btn icon small v-bind="attrs" v-on="on" @click.stop="confirmDelete(product)">
                    <v-icon small>mdi-delete-outline</v-icon>
                  </v-btn>
                </template>
                <span>Dar de baja</span>
              </v-tooltip>

              <v-tooltip bottom>
                <template #activator="{ on, attrs }">
                  <v-btn icon small color="success" v-bind="attrs" v-on="on" @click.stop="addToSale(product)">
                    <v-icon>mdi-cart-plus</v-icon>
                  </v-btn>
                </template>
                <span>Agregar a la venta</span>
              </v-tooltip>
            </v-list-item-action>
          </v-list-item>

          <v-divider v-if="index < products.length - 1" :key="`d-${product.id}`" />
        </template>
      </v-list>

      <div v-else class="text-center grey--text pa-8">
        <v-icon size="56" color="grey lighten-1">mdi-package-variant-remove</v-icon>
        <div class="mt-3">
          {{ query ? `Sin resultados para "${query}"` : 'Aún no hay productos registrados' }}
        </div>
        <v-btn v-if="query" text small color="primary" class="mt-2" @click="onQueryChange('')">
          Limpiar búsqueda
        </v-btn>
      </div>
    </div>

    <v-divider v-if="pagination.hasMore" />
    <div v-if="pagination.hasMore" class="text-center pa-2">
      <v-btn text small color="primary" :loading="loadingMore" @click="loadMore">
        Cargar más ({{ products.length }} de {{ pagination.total }})
      </v-btn>
    </div>

    <ProductFormDialog v-model="dialogOpen" :product="editingProduct" @saved="onProductSaved" />

    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Dar de baja producto</v-card-title>
        <v-card-text>
          ¿Confirmas dar de baja <strong>{{ deleteDialog.product && deleteDialog.product.name }}</strong
          >? Dejará de aparecer en el catálogo, pero se conserva en las ventas ya registradas.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="deleteDialog.open = false">Cancelar</v-btn>
          <v-btn color="error" depressed :loading="deleteDialog.saving" @click="performDelete">
            Dar de baja
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
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
        this.$emit('error', error.message);
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
        this.$emit('error', error.message);
      } finally {
        this.deleteDialog.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.catalog-results {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 240px;
  max-height: calc(100vh - 300px);
}
</style>
