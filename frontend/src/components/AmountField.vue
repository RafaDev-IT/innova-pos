<template>
  <v-text-field
    :value="value"
    v-bind="$attrs"
    prefix="$"
    inputmode="decimal"
    :rules="reglas"
    @input="onInput"
    @blur="onBlur"
    v-on="oyentes"
  >
    <template v-for="(_, slot) in $slots" #[slot]>
      <slot :name="slot" />
    </template>
  </v-text-field>
</template>

<script>
import { sanitizeAmountInput, isValidPrice } from '@/utils/money';

/**
 * Campo de importe.
 *
 * Filtra lo que se teclea en lugar de corregirlo al enviar: no deja entrar
 * letras, admite un solo separador decimal, acepta la coma del teclado latino
 * y corta en dos decimales. Así el campo nunca muestra un valor que el
 * servidor vaya a rechazar.
 */
export default {
  name: 'AmountField',

  inheritAttrs: false,

  props: {
    value: { type: [String, Number], default: '' },
    required: { type: Boolean, default: true },
    /** Importe mínimo aceptable; cero permite artículos de cortesía. */
    min: { type: Number, default: 0 },
  },

  computed: {
    oyentes() {
      // Se reenvían los demás oyentes sin pisar input ni blur, que este
      // componente maneja para poder filtrar y normalizar.
      const resto = { ...this.$listeners };
      delete resto.input;
      delete resto.blur;
      return resto;
    },

    reglas() {
      return [
        (v) => !this.required || (v !== null && v !== undefined && String(v).trim() !== '') || 'Indica un importe',
        (v) => !v || isValidPrice(v) || 'Debe ser un número válido',
        (v) => !v || Number(String(v).replace(',', '.')) >= this.min || `No puede ser menor que ${this.min}`,
      ];
    },
  },

  methods: {
    onInput(raw) {
      const limpio = sanitizeAmountInput(raw);
      // Si el filtro cambió el texto, se reescribe el campo para que el cursor
      // no quede detrás de un carácter que ya no está.
      if (limpio !== raw) {
        this.$nextTick(() => {
          const input = this.$el.querySelector('input');
          if (input) input.value = limpio;
        });
      }
      this.$emit('input', limpio);
    },

    /** Al salir del campo se completa a dos decimales: "7" pasa a "7.00". */
    onBlur(evento) {
      const actual = String(this.value || '').trim();
      if (actual && isValidPrice(actual)) {
        const normalizado = Number(actual).toFixed(2);
        if (normalizado !== actual) this.$emit('input', normalizado);
      }
      this.$emit('blur', evento);
    },
  },
};
</script>
