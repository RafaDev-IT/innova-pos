<template>
  <div class="product-card" :class="{ 'product-card--active': quantity > 0 }" @click="onCardClick">
    <div class="product-card__media">
      <img
        v-if="product.imageUrl && !imageFailed"
        :src="product.imageUrl"
        :alt="product.name"
        class="product-card__img"
        loading="lazy"
        @error="imageFailed = true"
      />
      <div v-else class="product-card__fallback" :style="{ background: gradient }">
        {{ initials }}
      </div>

      <span v-if="quantity > 0" class="product-card__badge product-card__badge--count">
        {{ quantity }} en la venta
      </span>
    </div>

    <div class="product-card__name" :title="product.name">{{ product.name }}</div>

    <!-- El código va en su propia línea y con marca de escáner: es el dato por
         el que se busca un producto, no un detalle secundario. -->
    <div class="product-card__barcode" :title="`Código de barras ${product.barcode}`">
      <v-icon size="13" color="#9aa3ae">mdi-barcode</v-icon>
      <span>{{ product.barcode }}</span>
    </div>

    <div class="product-card__meta">
      <span class="product-card__price">{{ formatCurrency(product.price) }}</span>
    </div>

    <div class="product-card__action">
      <!-- Con el producto ya en la venta, el botón se convierte en contador:
           es el gesto que el cajero necesita a continuación. -->
      <div v-if="quantity > 0" class="stepper" @click.stop>
        <button
          type="button"
          class="stepper__btn"
          title="Quitar una unidad"
          @click="$emit('decrease', product)"
        >
          <v-icon size="15" color="white">mdi-minus</v-icon>
        </button>
        <span class="stepper__value">{{ quantity }}</span>
        <button type="button" class="stepper__btn" title="Agregar otra unidad" @click="$emit('increase', product)">
          <v-icon size="15" color="white">mdi-plus</v-icon>
        </button>
      </div>

      <v-btn v-else depressed block small class="btn-soft" @click.stop="$emit('add', product)">
        Agregar
      </v-btn>
    </div>

    <div class="product-card__tools">
      <v-btn icon x-small title="Editar producto" @click.stop="$emit('edit', product)">
        <v-icon size="15">mdi-pencil-outline</v-icon>
      </v-btn>
      <v-btn icon x-small title="Dar de baja" @click.stop="$emit('remove', product)">
        <v-icon size="15">mdi-trash-can-outline</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script>
import { formatCurrency } from '@/utils/format';
import { fallbackGradient, initials } from '@/utils/productImage';

export default {
  name: 'ProductCard',

  props: {
    product: { type: Object, required: true },
    /** Unidades de este producto ya presentes en la venta. */
    quantity: { type: Number, default: 0 },
  },

  data: () => ({
    // Una URL rota no debe dejar un hueco: se cae al respaldo generado.
    imageFailed: false,
  }),

  computed: {
    gradient() {
      return fallbackGradient(this.product.name);
    },

    initials() {
      return initials(this.product.name);
    },
  },

  watch: {
    'product.imageUrl': function onImageChange() {
      this.imageFailed = false;
    },
  },

  methods: {
    formatCurrency,

    onCardClick() {
      this.$emit(this.quantity > 0 ? 'increase' : 'add', this.product);
    },
  },
};
</script>

<style scoped>
.product-card {
  position: relative;
}

.product-card__barcode {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  padding: 3px 8px;
  border-radius: var(--r-sm);
  background: var(--pos-surface-2);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.75rem;
  font-weight: 550;
  color: var(--pos-text-muted);
  letter-spacing: 0.02em;
  width: fit-content;
}

.product-card__badge--count {
  background: var(--pos-primary);
  left: auto;
  right: 8px;
}

/* Las acciones de administración aparecen al pasar el cursor: el gesto
   frecuente es vender, no editar, y mostrarlas siempre ensucia la rejilla. */
.product-card__tools {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.14s ease;
}
.product-card:hover .product-card__tools,
.product-card:focus-within .product-card__tools {
  opacity: 1;
}
.product-card__tools .v-btn {
  background: rgba(255, 255, 255, 0.94) !important;
  box-shadow: var(--pos-shadow-xs) !important;
}
</style>
