<template>
  <div class="panel">
    <header class="panel__head">
      <div>
        <div class="panel__title">Venta actual</div>
        <div class="panel__sub">
          {{ items.length ? `${unitCount} ${unitCount === 1 ? 'artículo' : 'artículos'}` : 'Sin artículos' }}
        </div>
      </div>
      <v-spacer />
      <v-btn v-if="items.length" icon small title="Vaciar la venta" @click="confirmClear">
        <v-icon size="19">mdi-notification-clear-all</v-icon>
      </v-btn>
    </header>

    <div class="panel__body scroll px-4">
      <div v-if="!items.length" class="empty">
        <div class="empty__icon">
          <v-icon size="28" color="primary">mdi-cart-outline</v-icon>
        </div>
        <div class="empty__title">Aún no hay artículos</div>
        <div class="empty__hint">Escanea un código o toca un producto del catálogo para comenzar.</div>
      </div>

      <div
        v-for="(item, index) in items"
        v-else
        :key="item.key"
        class="line"
        :class="{ 'line--edited': isEdited(item) }"
      >
        <div class="line__thumb">
          <img
            v-if="item.imageUrl && !failedImages[item.key]"
            :src="item.imageUrl"
            :alt="item.name"
            class="line__thumb-img"
            @error="$set(failedImages, item.key, true)"
          />
          <div v-else class="line__thumb-fallback" :style="{ background: gradientFor(item.name) }">
            {{ initialsFor(item.name) }}
          </div>
        </div>

        <div class="line__body">
          <div class="d-flex align-start">
            <div class="flex-grow-1 min-width-0">
              <div class="line__name" :title="item.name">{{ item.name }}</div>
              <div class="line__code">
                <v-icon size="11">mdi-barcode</v-icon>
                {{ item.barcode }}
              </div>
              <div v-if="isEdited(item)" class="line__tag">
                <v-icon size="11" color="accent">mdi-pencil</v-icon>
                Antes {{ formatCurrency(item.catalogPrice) }}
              </div>
            </div>
            <v-btn icon x-small class="ml-1" title="Quitar de la venta" @click="removeItem(index)">
              <v-icon size="16">mdi-close</v-icon>
            </v-btn>
          </div>

          <div class="line__foot">
            <v-text-field
              :value="item.unitPrice"
              class="price-field"
              outlined
              dense
              hide-details="auto"
              prefix="$"
              inputmode="decimal"
              :title="`Precio unitario en esta venta`"
              :error-messages="item.priceError ? [item.priceError] : []"
              @input="updatePrice(index, $event)"
            />

            <div class="qty">
              <button
                type="button"
                class="qty__btn"
                :disabled="item.quantity <= 1"
                title="Quitar una unidad"
                @click="changeQuantity(index, -1)"
              >
                <v-icon size="14">mdi-minus</v-icon>
              </button>
              <span class="qty__value">{{ item.quantity }}</span>
              <button type="button" class="qty__btn" title="Agregar una unidad" @click="changeQuantity(index, 1)">
                <v-icon size="14">mdi-plus</v-icon>
              </button>
            </div>

            <v-spacer />
            <span class="line__total">{{ formatCurrency(lineTotal(item)) }}</span>
          </div>
        </div>
      </div>
    </div>

    <footer class="sale__foot">
      <v-alert v-if="errorMessage" type="error" dense text class="mb-3">{{ errorMessage }}</v-alert>

      <div class="totals">
        <div class="totals__row">
          <span>Subtotal</span>
          <strong>{{ formatCurrency(totalAmount) }}</strong>
        </div>
        <div class="totals__row">
          <span>Artículos</span>
          <strong>{{ unitCount }}</strong>
        </div>
        <div v-if="editedCount" class="totals__row">
          <span class="chip-soft chip-amber">
            <v-icon size="12" color="accent">mdi-pencil</v-icon>
            {{ editedCount }} con precio ajustado
          </span>
        </div>

        <hr class="totals__divider" />

        <div class="totals__grand">
          <span class="totals__grand-label">Total</span>
          <span class="totals__grand-amount">{{ formatCurrency(totalAmount) }}</span>
        </div>
      </div>

      <v-btn depressed block class="btn-primary btn-tall mt-4" :disabled="!canSave" :loading="saving" @click="save">
        <v-icon left size="20">mdi-check-circle-outline</v-icon>
        Cobrar y guardar
        <kbd class="kbd kbd--on-primary ml-2">F9</kbd>
      </v-btn>
    </footer>

    <v-dialog v-model="clearDialog" max-width="410">
      <div class="dialog">
        <div class="dialog__head">
          <div class="dialog__icon dialog__icon--danger">
            <v-icon size="20" color="error">mdi-notification-clear-all</v-icon>
          </div>
          <div class="dialog__title">Vaciar la venta</div>
        </div>
        <div class="dialog__body">
          <p class="dialog__text mb-0">
            Se descartarán los <strong>{{ items.length }}</strong>
            {{ items.length === 1 ? 'renglón capturado' : 'renglones capturados' }}, incluidos los precios
            ajustados. No se puede deshacer.
          </p>
        </div>
        <div class="dialog__foot">
          <v-spacer />
          <v-btn text @click="clearDialog = false">Cancelar</v-btn>
          <v-btn color="error" depressed @click="clear">Vaciar</v-btn>
        </div>
      </div>
    </v-dialog>

    <v-dialog v-model="receipt.open" max-width="380">
      <div v-if="receipt.sale" class="dialog">
        <div class="receipt__hero">
          <div class="receipt__check">
            <v-icon size="30" color="white">mdi-check-bold</v-icon>
          </div>
          <div class="receipt__title">Venta registrada</div>
          <div class="receipt__folio">{{ receipt.sale.folio }}</div>
        </div>
        <div class="dialog__body">
          <div class="totals">
            <div class="totals__row">
              <span>Artículos</span>
              <strong>{{ receipt.sale.itemCount }}</strong>
            </div>
            <hr class="totals__divider" />
            <div class="totals__grand">
              <span class="totals__grand-label">Cobrado</span>
              <span class="totals__grand-amount">{{ formatCurrency(receipt.sale.total) }}</span>
            </div>
          </div>
        </div>
        <div class="dialog__foot">
          <v-btn depressed block class="btn-primary btn-tall" @click="receipt.open = false">
            <v-icon left size="19">mdi-cart-plus</v-icon>
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
import { fallbackGradient, initials } from '@/utils/productImage';

export default {
  name: 'SalePanel',

  data: () => ({
    items: [],
    saving: false,
    errorMessage: '',
    clearDialog: false,
    receipt: { open: false, sale: null },
    failedImages: {},
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

    /**
     * Unidades por producto. El catálogo lo usa para mostrar el contador sobre
     * la tarjeta correspondiente.
     */
    quantityByProduct() {
      return this.items.reduce((acc, item) => {
        acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
        return acc;
      }, {});
    },
  },

  watch: {
    // El catálogo vive en otra rama del árbol, así que el mapa se anuncia hacia
    // arriba en lugar de leerse por referencia.
    quantityByProduct: {
      immediate: true,
      handler(map) {
        this.$emit('cart-changed', map);
      },
    },
  },

  methods: {
    formatCurrency,

    gradientFor: fallbackGradient,
    initialsFor: initials,

    /**
     * Un renglón cuyo precio difiere del de catálogo. Se señala con color,
     * franja y etiqueta a la vez: confundir el precio de la venta con el del
     * catálogo cuesta dinero, y el color por sí solo no es accesible.
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
          imageUrl: product.imageUrl || null,
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

    /**
     * Quita una unidad del producto desde el catálogo. Actúa sobre el último
     * renglón que lo contiene, y lo elimina si se queda sin unidades.
     */
    decreaseProduct(product) {
      for (let i = this.items.length - 1; i >= 0; i -= 1) {
        if (this.items[i].productId === product.id) {
          if (this.items[i].quantity > 1) this.items[i].quantity -= 1;
          else this.items.splice(i, 1);
          return;
        }
      }
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
.min-width-0 {
  min-width: 0;
}

.line__code {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.6875rem;
  color: var(--pos-text-faint);
  margin-top: 2px;
}

.sale__foot {
  flex: 0 0 auto;
  padding: 4px 16px 16px;
}

.kbd--on-primary {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* Cabecera del comprobante: confirma de un vistazo, sin leer. */
.receipt__hero {
  background: var(--pos-primary);
  padding: 26px 22px 22px;
  text-align: center;
}
.receipt__check {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: grid;
  place-items: center;
  margin: 0 auto 12px;
}
.receipt__title {
  font-size: 1.0625rem;
  font-weight: 650;
  color: #fff;
}
.receipt__folio {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.82);
  margin-top: 2px;
}

.dialog__text {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--pos-text);
}
</style>
