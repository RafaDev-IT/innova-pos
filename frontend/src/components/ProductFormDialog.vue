<template>
  <v-dialog v-model="isOpen" max-width="500" persistent @keydown.esc="close">
    <div class="v-card dialog">
      <div class="dialog__head">
        <div class="dialog__icon dialog__icon--primary">
          <v-icon size="19" color="primary">{{ isEditing ? 'mdi-pencil-outline' : 'mdi-plus' }}</v-icon>
        </div>
        <div>
          <div class="dialog__title">{{ isEditing ? 'Editar producto' : 'Nuevo producto' }}</div>
          <div class="dialog__sub">
            {{ isEditing ? 'Los cambios no afectan las ventas ya registradas' : 'Quedará disponible para vender de inmediato' }}
          </div>
        </div>
      </div>

      <div class="dialog__body">
        <v-form ref="form" v-model="isFormValid" @submit.prevent="submit">
          <v-text-field
            ref="nameField"
            v-model="form.name"
            label="Nombre del producto"
            placeholder="Ej. Coca-Cola 600 ml"
            outlined
            dense
            autofocus
            counter="150"
            class="mb-1"
            :rules="rules.name"
            :error-messages="serverErrors.name"
            @input="clearServerError('name')"
          />

          <div class="d-flex" style="gap: 12px">
            <v-text-field
              v-model="form.barcode"
              label="Código de barras"
              placeholder="7410010000015"
              outlined
              dense
              class="pos-field-barcode mb-1"
              prepend-inner-icon="mdi-barcode"
              :hint="pistaCodigo"
              persistent-hint
              :rules="rules.barcode"
              :error-messages="serverErrors.barcode"
              @input="clearServerError('barcode')"
            >
              <!-- Leer con la cámara o pedir otro código sin salir del campo. -->
              <template #append>
                <v-btn icon x-small title="Escanear con la cámara" @click="scannerAbierto = true">
                  <v-icon size="17">mdi-barcode-scan</v-icon>
                </v-btn>
                <v-btn icon x-small title="Generar otro código" @click="regenerarCodigo">
                  <v-icon size="17">mdi-refresh</v-icon>
                </v-btn>
              </template>
            </v-text-field>

            <AmountField
              v-model="form.price"
              label="Precio"
              placeholder="0.00"
              outlined
              dense
              class="pos-field-price mb-1"
              :error-messages="serverErrors.price"
              @input="clearServerError('price')"
            />
          </div>

          <v-text-field
            v-model="form.imageUrl"
            label="Imagen (opcional)"
            placeholder="https://…"
            outlined
            dense
            class="mb-1"
            prepend-inner-icon="mdi-image-outline"
            hint="Si la dejas vacía se genera una portada a partir del nombre"
            persistent-hint
            :rules="rules.imageUrl"
            :error-messages="serverErrors.imageUrl"
            @input="clearServerError('imageUrl')"
          />

          <!-- Representación gráfica del código, para comprobar de un vistazo
               que es legible antes de imprimir la etiqueta. -->
          <div class="barcode-preview mb-3">
            <BarcodeImage :code="form.barcode" :height="58" />
          </div>

          <!-- Vista previa: confirma que la URL sirve antes de guardar. -->
          <div class="form-preview mt-3 mb-1">
            <div class="form-preview__thumb">
              <img
                v-if="form.imageUrl && !previewFailed"
                :src="form.imageUrl"
                alt=""
                class="form-preview__img"
                @error="previewFailed = true"
                @load="previewFailed = false"
              />
              <div v-else class="form-preview__fallback" :style="{ background: previewGradient }">
                {{ previewInitials }}
              </div>
            </div>
            <div class="form-preview__text">
              <div class="form-preview__label">Vista previa</div>
              <div class="form-preview__hint">
                {{
                  form.imageUrl && previewFailed
                    ? 'No se pudo cargar esa imagen; se usará la portada generada.'
                    : form.imageUrl
                      ? 'Así se verá en el catálogo.'
                      : 'Portada generada a partir del nombre.'
                }}
              </div>
            </div>
          </div>

          <v-textarea
            v-model="form.description"
            label="Descripción (opcional)"
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
      </div>

      <div class="dialog__foot">
        <span class="dialog__note">Nombre, código y precio son obligatorios</span>
        <v-spacer />
        <v-btn text :disabled="saving" @click="close">Cancelar</v-btn>
        <v-btn depressed class="btn-primary" :loading="saving" @click="submit">
          {{ isEditing ? 'Guardar cambios' : 'Agregar producto' }}
        </v-btn>
      </div>
    </div>

    <BarcodeScanner v-model="scannerAbierto" @scanned="onEscaneado" />
  </v-dialog>
</template>

<script>
import productService from '@/services/productService';
import { toAmountString } from '@/utils/format';
import { fallbackGradient, initials } from '@/utils/productImage';
import { generateEan13, isValidEan13 } from '@/utils/barcode';
import AmountField from '@/components/AmountField.vue';
import BarcodeImage from '@/components/BarcodeImage.vue';
import BarcodeScanner from '@/components/BarcodeScanner.vue';

const emptyForm = () => ({ name: '', barcode: '', price: '', description: '', imageUrl: '' });

export default {
  name: 'ProductFormDialog',

  components: { AmountField, BarcodeImage, BarcodeScanner },

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
    previewFailed: false,
    scannerAbierto: false,
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

    previewGradient() {
      return fallbackGradient(this.form.name || '');
    },

    previewInitials() {
      return this.form.name ? initials(this.form.name) : '?';
    },

    /**
     * Indica si el código es un EAN-13 legítimo. No bloquea el guardado:
     * un comercio puede usar códigos internos que no siguen la norma, y
     * rechazarlos sería imponer una regla que el negocio no pidió.
     */
    pistaCodigo() {
      const codigo = String(this.form.barcode || '').trim();
      if (!codigo) return 'Se genera uno automáticamente';
      if (isValidEan13(codigo)) return 'EAN-13 válido';
      if (/^\d{13}$/.test(codigo)) return 'Trece dígitos, pero el verificador no cuadra';
      return 'Código propio (no es un EAN-13)';
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
        description: [(v) => !v || v.length <= 1000 || 'Máximo 1000 caracteres'],
        imageUrl: [(v) => !v || /^https?:\/\/.+/.test(v) || 'Debe ser una URL completa (https://…)'],
      };
    },
  },

  watch: {
    // Cada apertura parte de un estado limpio: sin residuos de errores ni de
    // valores del producto editado anteriormente. `immediate` cubre el caso de
    // montar el diálogo ya abierto, donde el watcher no llegaría a dispararse.
    value: {
      immediate: true,
      handler(opened) {
        if (opened) this.reset();
      },
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
            imageUrl: this.product.imageUrl || '',
          }
        : emptyForm();

      this.previewFailed = false;

      // En alta se propone un código válido desde el inicio: el campo es
      // obligatorio y muchos artículos de tienda no traen uno impreso.
      if (!this.isEditing) this.form.barcode = generateEan13();

      this.serverErrors = {};
      this.generalError = '';
      this.saving = false;

      this.$nextTick(() => {
        if (this.$refs.form) this.$refs.form.resetValidation();
      });
    },

    /** Código leído con la cámara: sustituye al propuesto. */
    onEscaneado(codigo) {
      this.form.barcode = codigo;
      this.clearServerError('barcode');
    },

    regenerarCodigo() {
      this.form.barcode = generateEan13();
      this.clearServerError('barcode');
    },

    clearServerError(field) {
      if (this.serverErrors[field]) this.$delete(this.serverErrors, field);
      this.generalError = '';
    },

    buildPayload() {
      // Se normaliza campo a campo con respaldo: el formulario puede llegar
      // con claves ausentes si se asigna desde fuera.
      const texto = (valor) => String(valor || '').trim();

      return {
        name: texto(this.form.name),
        barcode: texto(this.form.barcode),
        price: toAmountString(texto(this.form.price).replace(',', '.')),
        description: texto(this.form.description) || null,
        imageUrl: texto(this.form.imageUrl) || null,
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

<style scoped>
.form-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--pos-surface-2);
  border-radius: var(--r-md);
  padding: 10px 12px;
}
.form-preview__thumb {
  width: 52px;
  height: 52px;
  border-radius: var(--r-sm);
  overflow: hidden;
  flex: 0 0 auto;
}
.form-preview__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.form-preview__fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 1.125rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}
.form-preview__label {
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--pos-text);
}
.form-preview__hint {
  font-size: 0.75rem;
  color: var(--pos-text-faint);
  line-height: 1.4;
  margin-top: 1px;
}

.dialog__sub {
  font-size: 0.78125rem;
  color: var(--pos-text-faint);
  margin-top: 1px;
  line-height: 1.4;
}

.dialog__note {
  font-size: 0.75rem;
  color: var(--pos-text-faint);
}

.pos-field-barcode {
  flex: 1 1 60%;
}
.pos-field-price {
  flex: 1 1 40%;
  max-width: 150px;
}
.pos-field-price input {
  font-weight: 600;
  text-align: right;
}
</style>
