<template>
  <div class="barcode">
    <svg
      v-if="barras"
      class="barcode__svg"
      :viewBox="`0 0 ${anchoTotal} ${altoTotal}`"
      :style="{ height: `${height}px` }"
      role="img"
      :aria-label="`Código de barras ${code}`"
    >
      <!-- Zona blanca de reserva incluida en el viewBox: sin margen alrededor,
           un lector no distingue dónde empieza el código. -->
      <rect :width="anchoTotal" :height="altoTotal" fill="#ffffff" />

      <g fill="#000000">
        <rect
          v-for="(barra, i) in barras"
          :key="i"
          :x="MARGEN + barra.x * modulo"
          y="0"
          :width="barra.width * modulo"
          :height="alturaBarra(barra.x)"
        />
      </g>

      <!-- Los dígitos van en la posición que marca la norma: el primero a la
           izquierda de las barras, y los dos grupos de seis bajo su mitad. -->
      <g fill="#000000" :font-size="fuente" font-family="ui-monospace, Menlo, monospace" text-anchor="middle">
        <text :x="MARGEN * 0.5" :y="altoTotal - 1">{{ code[0] }}</text>
        <text :x="MARGEN + 24.5 * modulo" :y="altoTotal - 1">{{ code.slice(1, 7) }}</text>
        <text :x="MARGEN + 71.5 * modulo" :y="altoTotal - 1">{{ code.slice(7) }}</text>
      </g>
    </svg>

    <!-- Un código propio del comercio no es representable como EAN-13; se dice
         en lugar de dibujar unas barras que ningún lector reconocería. -->
    <div v-else class="barcode__na">
      <v-icon size="15">mdi-barcode-off</v-icon>
      <span>{{ code ? 'Sin representación gráfica (no es un EAN-13)' : 'Sin código' }}</span>
    </div>
  </div>
</template>

<script>
import { bars, isGuardModule, TOTAL_MODULES } from '@/utils/ean13';

export default {
  name: 'BarcodeImage',

  props: {
    code: { type: String, default: '' },
    height: { type: Number, default: 60 },
  },

  data: () => ({
    // Ancho de un módulo en unidades del viewBox. La norma fija 0,33 mm; aquí
    // basta con que todos midan lo mismo, la escala la da el alto.
    modulo: 2,
    MARGEN: 18,
  }),

  computed: {
    barras() {
      return bars(this.code);
    },

    anchoTotal() {
      return TOTAL_MODULES * this.modulo + this.MARGEN * 2;
    },

    altoTotal() {
      return 74;
    },

    fuente() {
      return 11;
    },
  },

  methods: {
    /** Las guardas se prolongan por debajo de la línea de los dígitos. */
    alturaBarra(x) {
      return isGuardModule(x) ? 66 : 58;
    },
  },
};
</script>

<style scoped>
.barcode {
  display: inline-block;
}

.barcode__svg {
  display: block;
  width: auto;
  max-width: 100%;
  border-radius: 4px;
}

.barcode__na {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--pos-text-faint);
  padding: 8px 0;
}
</style>
