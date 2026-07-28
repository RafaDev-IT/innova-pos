<template>
  <div class="stat">
    <div class="stat__label">{{ label }}</div>
    <div class="stat__value">{{ value }}</div>
    <div class="stat__foot">
      <!-- La dirección se comunica con icono y signo, no solo con color: un
           lector que no distingue verde de rojo debe entenderlo igual. -->
      <span v-if="delta !== null" class="stat__delta" :class="deltaClass">
        <v-icon size="13" :color="deltaColor">{{ deltaIcon }}</v-icon>
        {{ deltaText }}
      </span>
      <span>{{ caption }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StatTile',

  props: {
    label: { type: String, required: true },
    value: { type: String, required: true },
    /** Variación porcentual; null cuando no hay base con la que comparar. */
    delta: { type: Number, default: null },
    caption: { type: String, default: '' },
    /** false cuando subir es malo (por ejemplo, devoluciones). */
    upIsGood: { type: Boolean, default: true },
  },

  computed: {
    direccion() {
      if (this.delta === null || Math.abs(this.delta) < 0.05) return 'flat';
      return this.delta > 0 ? 'up' : 'down';
    },

    esFavorable() {
      if (this.direccion === 'flat') return null;
      return (this.direccion === 'up') === this.upIsGood;
    },

    deltaClass() {
      if (this.esFavorable === null) return 'stat__delta--flat';
      return this.esFavorable ? 'stat__delta--up' : 'stat__delta--down';
    },

    deltaColor() {
      if (this.esFavorable === null) return 'grey';
      return this.esFavorable ? 'primary' : 'error';
    },

    deltaIcon() {
      return { up: 'mdi-trending-up', down: 'mdi-trending-down', flat: 'mdi-trending-neutral' }[
        this.direccion
      ];
    },

    deltaText() {
      if (this.delta === null) return '';
      const signo = this.delta > 0 ? '+' : '';
      return `${signo}${this.delta}%`;
    },
  },
};
</script>
