<template>
  <div class="pos-panel">
    <header class="pos-panel__head">
      <v-icon size="18" color="primary">mdi-cart-outline</v-icon>
      <span class="pos-panel__title">Venta actual</span>
      <v-spacer />
      <span v-if="items.length" class="pos-count-strong">
        {{ unitCount }} {{ unitCount === 1 ? 'artículo' : 'artículos' }}
      </span>
    </header>

    <div class="pos-panel__body pos-scroll">
      <div v-if="!items.length" class="pos-empty">
        <div class="pos-empty__icon">
          <v-icon size="26" color="grey">mdi-cart-outline</v-icon>
        </div>
        <div class="pos-empty__title">Sin artículos</div>
        <div class="pos-empty__hint">
          Escanea un código de barras o elige un producto del catálogo para comenzar la venta.
        </div>
      </div>

      <div
        v-for="(item, index) in items"
        v-else
        :key="item.key"
        class="pos-line"
        :class="{ 'pos-line--edited': isEdited(item) }"
      >
        <div class="d-flex align-start">
          <div class="pos-line__main">
            <div class="pos-row__name">{{ item.name }}</div>
            <div class="pos-line__sub">
              <span class="pos-barcode">{{ item.barcode }}</span>
              <span v-if="isEdited(item)" class="pos-line__tag">
                <v-icon size="11" color="accent">mdi-pencil</v-icon>
                Precio ajustado · antes {{ formatCurrency(item.catalogPrice) }}
              </span>
            </div>
          </div>

          <div class="pos-line__total">{{ formatCurrency(lineTotal(item)) }}</div>

          <v-btn
            icon
            small
            class="ml-1"
            color="error"
            title="Quitar de la venta"
            @click="removeItem(index)"
          >
            <v-icon size="17">mdi-close</v-icon>
          </v-btn>
        </div>

        <div class="pos-line__controls">
          <v-text-field
            :value="item.unitPrice"
            class="pos-price-field"
            outlined
            dense
            hide-details="auto"
            prefix="$"
            inputmode="decimal"
            :title="`Precio unitario de ${item.name} en esta venta`"
            :error-messages="item.priceError ? [item.priceError] : []"
            @input="updatePrice(index, $event)"
          />

          <span class="pos-line__x">×</span>

          <div class="pos-qty">
            <button
              class="pos-qty__btn"
              type="button"
              :disabled="item.quantity <= 1"
              title="Quitar una unidad"
              @click="changeQuantity(index, -1)"
            >
              <v-icon size="15">mdi-minus</v-icon>
            </button>
            <span class="pos-qty__value">{{ item.quantity }}</span>
            <button class="pos-qty__btn" type="button" title="Agregar una unidad" @click="changeQuantity(index, 1)">
              <v-icon size="15">mdi-plus</v-icon>
            </button>
          </div>
        </div>
      </div>
    </div>

    <v-alert v-if="errorMessage" type="error" dense text class="ma-3 mb-0">
      {{ errorMessage }}
    </v-alert>

    <!-- Losa del total: único elemento con este tratamiento en la pantalla. -->
    <div class="pos-total">
      <div class="d-flex align-center justify-space-between">
        <span class="pos-total__label">Total a cobrar</span>
        <span v-if="editedCount" class="pos-total__flag">
          <v-icon size="12" color="accent">mdi-pencil</v-icon>
          {{ editedCount }} con precio ajustado
        </span>
      </div>
      <div class="pos-total__amount">
        <span class="pos-total__currency">$</span>{{ totalAmount }}
      </div>
    </div>

    <footer class="pos-actions">
      <v-btn text class="pos-btn-clear" :disabled="!items.length || saving" @click="confirmClear">
        <v-icon left size="17">mdi-notification-clear-all</v-icon>
        Vaciar
      </v-btn>
      <v-btn
        depressed
        class="pos-btn-primary pos-btn-save ml-2"
        :disabled="!canSave"
        :loading="saving"
        @click="save"
      >
        <v-icon left size="19">mdi-check-bold</v-icon>
        Guardar venta
        <kbd class="pos-kbd pos-kbd--on-primary ml-2">F9</kbd>
      </v-btn>
    </footer>

    <v-dialog v-model="clearDialog" max-width="410">
      <div class="v-card pos-dialog">
        <div class="pos-dialog__head">
          <div class="pos-dialog__icon pos-dialog__icon--danger">
            <v-icon size="19" color="error">mdi-notification-clear-all</v-icon>
          </div>
          <span class="pos-dialog__title">Vaciar la venta</span>
        </div>
        <div class="pos-dialog__body">
          <p class="pos-dialog__text mb-0">
            Se descartarán los <strong>{{ items.length }}</strong>
            {{ items.length === 1 ? 'renglón capturado' : 'renglones capturados' }}, incluidos los precios
            que hayas ajustado. Esta acción no se puede deshacer.
          </p>
        </div>
        <div class="pos-dialog__foot">
          <v-spacer />
          <v-btn text @click="clearDialog = false">Cancelar</v-btn>
          <v-btn color="error" depressed @click="clear">Vaciar</v-btn>
        </div>
      </div>
    </v-dialog>

    <v-dialog v-model="receipt.open" max-width="400">
      <div v-if="receipt.sale" class="v-card pos-dialog">
        <div class="pos-dialog__head">
          <div class="pos-dialog__icon pos-dialog__icon--success">
            <v-icon size="20" color="success">mdi-check-bold</v-icon>
          </div>
          <span class="pos-dialog__title">Venta registrada</span>
        </div>
        <div class="pos-dialog__body">
          <div class="pos-receipt__row">
            <span>Folio</span>
            <strong class="pos-receipt__folio">{{ receipt.sale.folio }}</strong>
          </div>
          <div class="pos-receipt__row">
            <span>Artículos</span>
            <strong>{{ receipt.sale.itemCount }}</strong>
          </div>
          <div class="pos-receipt__total">
            <span class="pos-total__label" style="color: var(--pos-text-muted)">Total cobrado</span>
            <span class="pos-receipt__amount">{{ formatCurrency(receipt.sale.total) }}</span>
          </div>
        </div>
        <div class="pos-dialog__foot">
          <v-spacer />
          <v-btn depressed class="pos-btn-primary" @click="receipt.open = false">
            <v-icon left size="17">mdi-cart-plus</v-icon>
            Nueva venta
          </v-btn>
        </div>
      </div>
    </v-dialog>
  </div>
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

    editedCount() {
      return this.items.filter((item) => this.isEdited(item)).length;
    },
  },

  methods: {
    formatCurrency,

    /**
     * Un renglón cuyo precio difiere del de catálogo. Se señala con color,
     * franja lateral y etiqueta a la vez: confundir el precio de la venta con
     * el del catálogo cuesta dinero, y el color por sí solo no es accesible.
     */
    isEdited(item) {
      const actual = toCents(item.unitPrice);
      const original = toCents(item.catalogPrice);
      return actual !== null && original !== null && actual !== original;
    },

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
          // Se conserva el precio de catálogo para poder señalar después si el
          // cajero lo ajustó, y mostrar cuál era.
          catalogPrice: product.price,
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
        this.$emit('error', error);
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.pos-count-strong {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pos-primary);
  background: var(--pos-primary-soft);
  border-radius: 999px;
  padding: 2px 10px;
}

.pos-line__main {
  flex: 1 1 auto;
  min-width: 0;
}

.pos-line__sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 3px;
}

.pos-line__controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 9px;
}

.pos-line__x {
  color: var(--pos-text-faint);
  font-size: 0.875rem;
}

.pos-total__flag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--pos-accent);
}

.pos-actions {
  display: flex;
  align-items: center;
  padding: 12px 16px 14px;
  background: var(--pos-surface);
  border-top: 1px solid var(--pos-border);
}

.pos-btn-clear {
  flex: 0 0 auto;
  height: 50px !important;
  color: var(--pos-text-muted) !important;
}

/* `block` de Vuetify aplica ancho 100% del contenedor sin descontar el botón
   hermano, lo que desbordaba el panel. Con flex ocupa el espacio restante. */
.pos-actions .pos-btn-save {
  flex: 1 1 auto;
  min-width: 0;
}

.pos-kbd--on-primary {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.28);
  color: #fff;
}

.pos-dialog__text {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--pos-text);
}
</style>
