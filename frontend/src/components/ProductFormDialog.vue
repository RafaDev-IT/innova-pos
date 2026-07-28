<template>
  <v-dialog v-model="isOpen" max-width="560" persistent @keydown.esc="close">
    <v-card>
      <v-card-title class="text-h6 primary white--text py-3">
        <v-icon left dark>{{ isEditing ? 'mdi-pencil' : 'mdi-plus-box' }}</v-icon>
        {{ isEditing ? 'Editar producto' : 'Nuevo producto' }}
      </v-card-title>

      <v-card-text class="pt-6">
        <v-form ref="form" v-model="isFormValid" @submit.prevent="submit">
          <v-text-field
            ref="nameField"
            v-model="form.name"
            label="Nombre *"
            placeholder="Ej. Coca-Cola 600 ml"
            outlined
            dense
            autofocus
            counter="150"
            :rules="rules.name"
            :error-messages="serverErrors.name"
            @input="clearServerError('name')"
          />

          <v-text-field
            v-model="form.barcode"
            label="Código de barras *"
            placeholder="Ej. 7501055300013"
            outlined
            dense
            prepend-inner-icon="mdi-barcode"
            :rules="rules.barcode"
            :error-messages="serverErrors.barcode"
            @input="clearServerError('barcode')"
          />

          <v-text-field
            v-model="form.price"
            label="Precio *"
            placeholder="0.00"
            outlined
            dense
            prefix="$"
            inputmode="decimal"
            :rules="rules.price"
            :error-messages="serverErrors.price"
            @input="clearServerError('price')"
          />

          <v-textarea
            v-model="form.description"
            label="Descripción"
            outlined
            dense
            rows="2"
            counter="1000"
            :rules="rules.description"
          />

          <v-alert v-if="generalError" type="error" dense text class="mb-0">
            {{ generalError }}
          </v-alert>

          <!-- Permite enviar con Enter sin exponer un botón extra. -->
          <button type="submit" class="d-none" />
        </v-form>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <span class="text-caption grey--text">* Campos obligatorios</span>
        <v-spacer />
        <v-btn text :disabled="saving" @click="close">Cancelar</v-btn>
        <v-btn color="primary" depressed :loading="saving" @click="submit">
          {{ isEditing ? 'Guardar cambios' : 'Agregar producto' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import productService from '@/services/productService';
import { toAmountString } from '@/utils/format';

const emptyForm = () => ({ name: '', barcode: '', price: '', description: '' });

export default {
  name: 'ProductFormDialog',

  props: {
    value: { type: Boolean, default: false },
    /** Producto a editar; si es null el diálogo opera en modo alta. */
    product: { type: Object, default: null },
  },

  data: () => ({
    form: emptyForm(),
    isFormValid: false,
    saving: false,
    serverErrors: {},
    generalError: '',
  }),

  computed: {
    isOpen: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },

    isEditing() {
      return Boolean(this.product && this.product.id);
    },

    rules() {
      return {
        name: [
          (v) => !!(v || '').trim() || 'El nombre es obligatorio',
          (v) => (v || '').trim().length >= 2 || 'Debe tener al menos 2 caracteres',
          (v) => (v || '').length <= 150 || 'Máximo 150 caracteres',
        ],
        barcode: [
          (v) => !!(v || '').trim() || 'El código de barras es obligatorio',
          (v) => (v || '').length <= 64 || 'Máximo 64 caracteres',
          (v) => /^[\w.-]+$/.test((v || '').trim()) || 'Solo letras, números, guiones y puntos',
        ],
        price: [
          (v) => (v !== null && v !== undefined && String(v).trim() !== '') || 'El precio es obligatorio',
          (v) => !Number.isNaN(Number(String(v).replace(',', '.'))) || 'Debe ser un número',
          (v) => Number(String(v).replace(',', '.')) >= 0 || 'No puede ser negativo',
        ],
        description: [(v) => !v || v.length <= 1000 || 'Máximo 1000 caracteres'],
      };
    },
  },

  watch: {
    // Cada apertura parte de un estado limpio: sin residuos de errores ni de
    // valores del producto editado anteriormente.
    value(opened) {
      if (opened) this.reset();
    },
  },

  methods: {
    reset() {
      this.form = this.isEditing
        ? {
            name: this.product.name,
            barcode: this.product.barcode,
            price: this.product.price,
            description: this.product.description || '',
          }
        : emptyForm();

      this.serverErrors = {};
      this.generalError = '';
      this.saving = false;

      this.$nextTick(() => {
        if (this.$refs.form) this.$refs.form.resetValidation();
      });
    },

    clearServerError(field) {
      if (this.serverErrors[field]) this.$delete(this.serverErrors, field);
      this.generalError = '';
    },

    buildPayload() {
      return {
        name: this.form.name.trim(),
        barcode: this.form.barcode.trim(),
        price: toAmountString(String(this.form.price).replace(',', '.')),
        description: this.form.description.trim() || null,
      };
    },

    async submit() {
      if (!this.$refs.form.validate()) return;

      this.saving = true;
      this.serverErrors = {};
      this.generalError = '';

      try {
        const payload = this.buildPayload();
        const saved = this.isEditing
          ? await productService.update(this.product.id, payload)
          : await productService.create(payload);

        this.$emit('saved', saved, this.isEditing);
        this.isOpen = false;
      } catch (error) {
        // Los errores por campo se pintan en su input; el resto en la alerta.
        const fieldErrors = error.fieldErrors || {};
        if (Object.keys(fieldErrors).length) {
          this.serverErrors = fieldErrors;
        } else {
          this.generalError = error.message;
        }
      } finally {
        this.saving = false;
      }
    },

    close() {
      if (this.saving) return;
      this.isOpen = false;
    },
  },
};
</script>
