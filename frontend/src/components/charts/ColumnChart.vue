<template>
  <div class="chart" @mouseleave="hovered = null">
    <svg :viewBox="`0 0 ${W} ${H}`" width="100%" :height="H" role="img" :aria-label="ariaLabel">
      <!-- Rejilla horizontal: fina, continua y recesiva. Nunca punteada, que
           compite en peso visual con los datos. -->
      <g>
        <line
          v-for="tick in ticks"
          :key="`g-${tick.value}`"
          class="chart__grid-line"
          :x1="PAD_L"
          :x2="W - PAD_R"
          :y1="tick.y"
          :y2="tick.y"
        />
        <text
          v-for="tick in ticks"
          :key="`t-${tick.value}`"
          class="chart__axis-text"
          :x="PAD_L - 8"
          :y="tick.y + 3.5"
          text-anchor="end"
        >
          {{ tick.label }}
        </text>
      </g>

      <!-- Columnas. El extremo de dato va redondeado y la base cuadrada, para
           que la barra siga apoyada en la línea cero. -->
      <g>
        <path
          v-for="(bar, i) in bars"
          v-show="bar.path"
          :key="`b-${i}`"
          class="chart__bar"
          :class="{ 'chart__bar--dim': hovered !== null && hovered !== i }"
          :d="bar.path"
        />
      </g>

      <!-- Etiquetas del eje horizontal, una de cada tres para que no se pisen. -->
      <text
        v-for="(bar, i) in bars"
        v-show="i % labelEvery === 0"
        :key="`x-${i}`"
        class="chart__axis-text"
        :x="bar.cx"
        :y="H - 6"
        text-anchor="middle"
      >
        {{ bar.label }}
      </text>

      <!-- Zonas sensibles más anchas que la columna: acertar una barra de 8 px
           con el ratón es incómodo. -->
      <rect
        v-for="(bar, i) in bars"
        :key="`h-${i}`"
        class="chart__hit"
        :x="bar.hitX"
        :y="PAD_T"
        :width="bar.hitW"
        :height="plotH"
        @mouseenter="hovered = i"
      />
    </svg>

    <div v-if="tip" class="chart__tip" :style="tip.style">
      <strong>{{ tip.value }}</strong>
      <div>{{ tip.caption }}</div>
    </div>
  </div>
</template>

<script>
/**
 * Gráfica de columnas de una sola serie.
 *
 * Una serie no lleva leyenda: solo hay un color y el título ya dice qué se
 * está midiendo; una caja con un único cuadro repite el título y ocupa espacio.
 *
 * Se dibuja en SVG en lugar de usar una librería de gráficas: para dos formas
 * sencillas, una dependencia añade cientos de kilobytes al paquete y quita el
 * control sobre las especificaciones de marca.
 */
const W_POR_DEFECTO = 720;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 24;
const MAX_BAR = 24; // Nunca llenar el carril: el aire restante separa.
const GAP = 2; // Separación en color de superficie entre columnas contiguas.

export default {
  name: 'ColumnChart',

  props: {
    /** [{ label, value, caption }] */
    points: { type: Array, required: true },
    height: { type: Number, default: 220 },
    ariaLabel: { type: String, default: 'Gráfica de columnas' },
    /** Formatea el valor para eje y etiqueta flotante. */
    format: { type: Function, default: (v) => String(v) },
  },

  data: () => ({
    PAD_R,
    PAD_T,
    hovered: null,
    /**
     * Ancho real del contenedor.
     *
     * El viewBox se ajusta a esta medida en lugar de dejar que el SVG se
     * escale: con un viewBox fijo, colocar la gráfica a media pantalla encoge
     * el texto del eje hasta hacerlo ilegible y deja una franja vacía por la
     * diferencia de proporción entre el viewBox y la caja renderizada.
     */
    W: W_POR_DEFECTO,
    observador: null,
  }),

  computed: {
    H() {
      return this.height;
    },

    /**
     * Margen izquierdo calculado a partir de la etiqueta más larga del eje.
     * Con un valor fijo, "$300.00" se recorta contra el borde y se lee "¡300.00".
     */
    PAD_L() {
      const masLarga = this.ticks.reduce((max, t) => Math.max(max, String(t.label).length), 0);
      return Math.max(34, Math.min(78, masLarga * 6.2 + 14));
    },

    plotW() {
      return this.W - this.PAD_L - PAD_R;
    },

    plotH() {
      return this.H - PAD_T - PAD_B;
    },

    max() {
      const mayor = Math.max(...this.points.map((p) => Number(p.value) || 0), 0);
      if (mayor === 0) return 1;
      // Se redondea hacia arriba a una cifra limpia para que el eje tenga
      // valores legibles y no un tope arbitrario.
      const magnitud = 10 ** Math.floor(Math.log10(mayor));
      return Math.ceil(mayor / (magnitud / 2)) * (magnitud / 2);
    },

    ticks() {
      const cuantos = 4;
      return Array.from({ length: cuantos + 1 }, (_, i) => {
        const valor = (this.max / cuantos) * i;
        return {
          value: valor,
          label: this.format(valor),
          y: PAD_T + this.plotH - (valor / this.max) * this.plotH,
        };
      });
    },

    labelEvery() {
      return this.points.length > 16 ? 3 : this.points.length > 8 ? 2 : 1;
    },

    bars() {
      const carril = this.plotW / this.points.length;
      const ancho = Math.min(MAX_BAR, Math.max(3, carril - GAP * 2));
      const radio = Math.min(4, ancho / 2);

      return this.points.map((p, i) => {
        const valor = Number(p.value) || 0;
        const alto = (valor / this.max) * this.plotH;
        const x = this.PAD_L + carril * i + (carril - ancho) / 2;
        const base = PAD_T + this.plotH;
        const y = base - alto;

        // Un valor cero no dibuja marca: un muñón de un píxel afirma que hubo
        // algo de actividad donde no hubo ninguna.
        // Extremo superior redondeado y base recta; por debajo del radio se
        // dibuja un rectángulo plano para no deformar la punta.
        let path = '';
        if (valor > 0) {
          path =
            alto <= radio
              ? `M${x},${base} h${ancho} v${-Math.max(alto, 1.5)} h${-ancho} Z`
              : `M${x},${base} L${x},${y + radio} Q${x},${y} ${x + radio},${y}` +
                ` L${x + ancho - radio},${y} Q${x + ancho},${y} ${x + ancho},${y + radio}` +
                ` L${x + ancho},${base} Z`;
        }

        return {
          path,
          cx: this.PAD_L + carril * i + carril / 2,
          hitX: this.PAD_L + carril * i,
          hitW: carril,
          label: p.label,
          value: valor,
          caption: p.caption || '',
        };
      });
    },

    tip() {
      if (this.hovered === null) return null;
      const bar = this.bars[this.hovered];
      if (!bar) return null;

      // Se sujeta a los bordes para que la etiqueta no se salga del panel.
      const porcentaje = Math.min(Math.max((bar.cx / this.W) * 100, 6), 94);
      return {
        value: this.format(bar.value),
        caption: `${bar.label}${bar.caption ? ` · ${bar.caption}` : ''}`,
        style: {
          left: `${porcentaje}%`,
          top: '4px',
          transform: 'translateX(-50%)',
        },
      };
    },
  },

  mounted() {
    this.medir();
    if (window.ResizeObserver) {
      this.observador = new ResizeObserver(() => this.medir());
      this.observador.observe(this.$el);
    } else {
      // Sin ResizeObserver se cae al evento de ventana, menos preciso pero
      // suficiente: cubre el cambio de tamaño y la rotación del dispositivo.
      window.addEventListener('resize', this.medir);
    }
  },

  beforeDestroy() {
    if (this.observador) this.observador.disconnect();
    else window.removeEventListener('resize', this.medir);
  },

  methods: {
    medir() {
      const ancho = this.$el ? this.$el.clientWidth : 0;
      if (ancho > 0) this.W = Math.round(ancho);
    },
  },
};
</script>
