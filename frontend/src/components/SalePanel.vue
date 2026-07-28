<template>
  <v-card outlined class="d-flex flex-column fill-height">
    <v-card-title class="pb-2">
      <v-icon left color="primary">mdi-cart-outline</v-icon>
      <span class="text-subtitle-1 font-weight-bold">Venta actual</span>
      <v-spacer />
      <v-chip small :color="items.length ? 'primary' : 'grey lighten-1'" dark>
        {{ unitCount }} {{ unitCount === 1 ? 'artículo' : 'artículos' }}
      </v-chip>
    </v-card-title>

    <v-divider />

    <div class="sale-items">
      <div v-if="!items.length" class="text-center grey--text pa-8">
        <v-icon size="56" color="grey lighten-1">mdi-cart-off</v-icon>
        <div class="mt-3">La venta está vacía</div>
        <div class="text-caption mt-1">Busca un producto en el catálogo para agregarlo</div>
      </div>

      <v-list v-else two-line class="py-0">
        <template v-for="(item, index) in items">
          <v-list-item :key="item.key">
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium">{{ item.name }}</v-list-item-title>

              <v-list-item-subtitle class="d-flex align-center flex-wrap mt-1">
                <!-- Precio editable dentro de la venta: no altera el catálogo. -->
                <v-text-field
                  :value="item.unitPrice"
                  class="price-input mr-3"
                  dense
                  outlined
                  hide-details="auto"
                  prefix="$"
                  inputmode="decimal"
                  :error-messages="item.priceError ? [item.priceError] : []"
                  @input="updatePrice(index, $event)"
                />

                <div class="d-flex align-center">
                  <v-btn icon x-small :disabled="item.quantity <= 1" @click="changeQuantity(index, -1)">
                    <v-icon small>mdi-minus</v-icon>
                  </v-btn>
                  <span class="mx-2 font-weight-medium">{{ item.quantity }}</span>
                  <v-btn icon x-small @click="changeQuantity(index, 1)">
                    <v-icon small>mdi-plus</v-icon>
                  </v-btn>
                </div>
              </v-list-item-subtitle>
            </v-list-item-content>

            <v-list-item-action class="flex-row align-center">
              <span class="text-subtitle-1 font-weight-bold mr-3">{{ formatCurrency(lineTotal(item)) }}</span>
              <v-tooltip bottom>
                <template #activator="{ on, attrs }">
                  <v-btn icon small color="error" v-bind="attrs" v-on="on" @click="removeItem(index)">
                    <v-icon small>mdi-delete-outline</v-icon>
                  </v-btn>
                </template>
                <span>Quitar de la venta</span>
              </v-tooltip>
            </v-list-item-action>
          </v-list-item>

          <v-divider v-if="index < items.length - 1" :key="`d-${item.key}`" />
        </template>
      </v-list>
    </div>

    <v-divider />

    <div class="pa-4 grey lighten-5">
      <div class="d-flex align-center justify-space-between mb-3">
        <span class="text-h6">Total</span>
        <span class="text-h4 font-weight-bold primary--text">{{ formatCurrency(totalAmount) }}</span>
      </div>

      <v-alert v-if="errorMessage" type="error" dense text class="mb-3">{{ errorMessage }}</v-alert>

      <div class="d-flex">
        <v-btn text class="flex-grow-1 mr-2" :disabled="!items.length || saving" @click="confirmClear">
          Vaciar
        </v-btn>
        <v-btn
          color="primary"
          depressed
          large
          class="flex-grow-1"
          :disabled="!canSave"
          :loading="saving"
          @click="save"
        >
          <v-icon left>mdi-content-save</v-icon>
          Guardar venta
        </v-btn>
      </div>
    </div>

    <v-dialog v-model="clearDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Vaciar la venta</v-card-title>
        <v-card-text>Se quitarán los {{ items.length }} renglones capturados. ¿Continuar?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="clearDialog = false">Cancelar</v-btn>
          <v-btn color="error" depressed @click="clear">Vaciar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="receipt.open" max-width="420">
      <v-card v-if="receipt.sale">
        <v-card-title class="success white--text py-3">
          <v-icon left dark>mdi-check-circle</v-icon>
          Venta registrada
        </v-card-title>
        <v-card-text class="pt-5">
          <div class="d-flex justify-space-between mb-2">
            <span class="grey--text">Folio</span>
            <strong>{{ receipt.sale.folio }}</strong>
          </div>
          <div class="d-flex justify-space-between mb-2">
            <span class="grey--text">Artículos</span>
            <strong>{{ receipt.sale.itemCount }}</strong>
          </div>
          <v-divider class="my-3" />
          <div class="d-flex justify-space-between">
            <span class="text-h6">Total</span>
            <span class="text-h5 font-weight-bold primary--text">
              {{ formatCurrency(receipt.sale.total) }}
            </span>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" depressed @click="receipt.open = false">Nueva venta</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script>
import saleService from '@/services/saleService';
import { formatCurrency } from '@/utils/format';
import { fromCents, lineTotalCents, isValidPrice, toCents } from '@/utils/money';

export default {
  name: 'SalePanel',

  data: () => ({
    items: [],
    saving: false,
    errorMessage: '',
    clearDialog: false,
    receipt: { open: false, sale: null },
    // Identificador local del renglón: dos renglones pueden referir al mismo
    // producto con precios distintos, así que el productId no sirve como clave.
    nextKey: 1,
  }),

  computed: {
    unitCount() {
      return this.items.reduce((sum, item) => sum + item.quantity, 0);
    },

    totalAmount() {
      const cents = this.items.reduce((sum, item) => sum + lineTotalCents(item.unitPrice, item.quantity), 0);
      return fromCents(cents);
    },

    hasInvalidPrice() {
      return this.items.some((item) => !isValidPrice(item.unitPrice));
    },

    canSave() {
      return this.items.length > 0 && !this.hasInvalidPrice && !this.saving;
    },
  },

  methods: {
    formatCurrency,

    lineTotal(item) {
      return fromCents(lineTotalCents(item.unitPrice, item.quantity));
    },

    /**
     * Agrega un producto a la venta. Si ya está presente con su precio de
     * catálogo intacto, se incrementa la cantidad en lugar de duplicar el
     * renglón: es lo que espera un cajero que escanea dos veces el mismo
     * artículo. Un renglón con precio editado no se toca.
     */
    addProduct(product) {
      const existing = this.items.find(
        (item) => item.productId === product.id && item.unitPrice === product.price,
      );

      if (existing) {
        existing.quantity += 1;
      } else {
        this.items.push({
          key: this.nextKey++,
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          unitPrice: product.price,
          quantity: 1,
          priceError: '',
        });
      }

      this.errorMessage = '';
    },

    updatePrice(index, value) {
      const item = this.items[index];
      item.unitPrice = value;
      item.priceError = isValidPrice(value) ? '' : 'Precio inválido';
    },

    changeQuantity(index, delta) {
      const item = this.items[index];
      const next = item.quantity + delta;
      if (next >= 1) item.quantity = next;
    },

    removeItem(index) {
      this.items.splice(index, 1);
      this.errorMessage = '';
    },

    confirmClear() {
      this.clearDialog = true;
    },

    clear() {
      this.items = [];
      this.errorMessage = '';
      this.clearDialog = false;
    },

    async save() {
      if (!this.canSave) return;

      this.saving = true;
      this.errorMessage = '';

      try {
        const sale = await saleService.create(
          this.items.map((item) => ({
            productId: item.productId,
            // Se normaliza a dos decimales para que el servidor reciba siempre
            // el mismo formato, sin importar cómo lo haya tecleado el cajero.
            unitPrice: fromCents(toCents(item.unitPrice)),
            quantity: item.quantity,
          })),
        );

        this.receipt = { open: true, sale };
        this.items = [];
        this.$emit('saved', sale);
      } catch (error) {
        this.errorMessage = error.message;
        this.$emit('error', error.message);
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.sale-items {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 240px;
  max-height: calc(100vh - 380px);
}

.price-input {
  max-width: 120px;
}
</style>
