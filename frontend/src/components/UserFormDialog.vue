<template>
  <v-dialog v-model="isOpen" max-width="520" persistent @keydown.esc="close">
    <div class="v-card dialog">
      <div class="dialog__head">
        <div class="dialog__icon dialog__icon--primary">
          <v-icon size="19" color="primary">{{ isEditing ? 'mdi-account-edit-outline' : 'mdi-account-plus-outline' }}</v-icon>
        </div>
        <div>
          <div class="dialog__title">{{ isEditing ? 'Editar usuario' : 'Nuevo usuario' }}</div>
          <div class="dialog__sub">
            {{ isEditing ? 'Deja la contraseña en blanco para conservarla' : 'Podrá iniciar sesión de inmediato' }}
          </div>
        </div>
      </div>

      <div class="dialog__body">
        <v-form ref="form" v-model="isFormValid" @submit.prevent="submit">
          <v-text-field
            v-model="form.name"
            label="Nombre completo"
            placeholder="Ej. Laura Méndez"
            outlined
            dense
            autofocus
            counter="120"
            class="mb-1"
            :rules="rules.name"
            :error-messages="serverErrors.name"
            @input="clearServerError('name')"
          />

          <div class="d-flex" style="gap: 12px">
            <v-text-field
              v-model="form.username"
              label="Usuario"
              placeholder="laura.mendez"
              outlined
              dense
              class="mb-1"
              prepend-inner-icon="mdi-at"
              :rules="rules.username"
              :error-messages="serverErrors.username"
              @input="clearServerError('username')"
            />

            <v-select
              v-model="form.role"
              :items="roleOptions"
              label="Rol"
              outlined
              dense
              class="mb-1 pos-role-select"
              :error-messages="serverErrors.role"
              @change="clearServerError('role')"
            />
          </div>

          <v-text-field
            v-model="form.email"
            label="Correo (opcional)"
            outlined
            dense
            class="mb-1"
            prepend-inner-icon="mdi-email-outline"
            :rules="rules.email"
            :error-messages="serverErrors.email"
            @input="clearServerError('email')"
          />

          <v-text-field
            v-model="form.password"
            :label="isEditing ? 'Nueva contraseña (opcional)' : 'Contraseña'"
            outlined
            dense
            class="mb-1"
            autocomplete="new-password"
            prepend-inner-icon="mdi-lock-outline"
            :type="showPassword ? 'text' : 'password'"
            :append-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :hint="`Mínimo ${MIN_PASSWORD} caracteres`"
            persistent-hint
            :rules="rules.password"
            :error-messages="serverErrors.password"
            @click:append="showPassword = !showPassword"
            @input="clearServerError('password')"
          />

          <v-switch
            v-model="form.isActive"
            :label="form.isActive ? 'Cuenta activa' : 'Cuenta desactivada'"
            color="primary"
            hide-details
            class="mt-4 mb-2"
            :disabled="isSelf"
          />
          <p v-if="isSelf" class="dialog__note mb-0">
            No puedes desactivar ni cambiar el rol de tu propia cuenta.
          </p>

          <v-alert v-if="generalError" type="error" dense text class="mb-0 mt-3">
            {{ generalError }}
          </v-alert>

          <button type="submit" class="d-none" />
        </v-form>
      </div>

      <div class="dialog__foot">
        <v-spacer />
        <v-btn text :disabled="saving" @click="close">Cancelar</v-btn>
        <v-btn depressed class="btn-primary" :loading="saving" @click="submit">
          {{ isEditing ? 'Guardar cambios' : 'Crear usuario' }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script>
import userService from '@/services/userService';
import session from '@/store/session';

// En espejo con la regla del backend.
const MIN_PASSWORD = 12;

const emptyForm = () => ({
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'cashier',
  isActive: true,
});

export default {
  name: 'UserFormDialog',

  props: {
    value: { type: Boolean, default: false },
    /** Usuario a editar; si es null el diálogo opera en modo alta. */
    user: { type: Object, default: null },
  },

  data: () => ({
    MIN_PASSWORD,
    form: emptyForm(),
    isFormValid: false,
    showPassword: false,
    saving: false,
    serverErrors: {},
    generalError: '',
    roleOptions: [
      { value: 'admin', text: 'Administrador' },
      { value: 'supervisor', text: 'Supervisor' },
      { value: 'cashier', text: 'Cajero' },
    ],
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
      return Boolean(this.user && this.user.id);
    },

    /** Editando la propia cuenta: rol y estado quedan bloqueados. */
    isSelf() {
      return Boolean(this.user && session.state.user && this.user.id === session.state.user.id);
    },

    rules() {
      return {
        name: [
          (v) => !!(v || '').trim() || 'El nombre es obligatorio',
          (v) => (v || '').trim().length >= 3 || 'Debe tener al menos 3 caracteres',
        ],
        username: [
          (v) => !!(v || '').trim() || 'El usuario es obligatorio',
          (v) => (v || '').trim().length >= 3 || 'Debe tener al menos 3 caracteres',
          (v) => /^[a-zA-Z0-9._-]*$/.test(v || '') || 'Solo letras, números, punto, guion y guion bajo',
        ],
        email: [(v) => !v || /^\S+@\S+\.\S+$/.test(v) || 'Correo inválido'],
        password: [
          // En alta es obligatoria; en edición, dejarla vacía conserva la actual.
          (v) => this.isEditing || !!v || 'La contraseña es obligatoria',
          (v) => !v || v.length >= MIN_PASSWORD || `Mínimo ${MIN_PASSWORD} caracteres`,
        ],
      };
    },
  },

  watch: {
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
            name: this.user.name,
            username: this.user.username,
            email: this.user.email || '',
            password: '',
            role: this.user.role,
            isActive: this.user.isActive,
          }
        : emptyForm();

      this.serverErrors = {};
      this.generalError = '';
      this.saving = false;
      this.showPassword = false;

      this.$nextTick(() => {
        if (this.$refs.form) this.$refs.form.resetValidation();
      });
    },

    clearServerError(field) {
      if (this.serverErrors[field]) this.$delete(this.serverErrors, field);
      this.generalError = '';
    },

    buildPayload() {
      const payload = {
        name: this.form.name.trim(),
        username: this.form.username.trim(),
        email: this.form.email.trim() || null,
        isActive: this.form.isActive,
      };

      // El rol de la propia cuenta no se envía: el backend lo rechazaría.
      if (!this.isSelf) payload.role = this.form.role;
      // En edición, contraseña vacía significa "no cambiarla".
      if (this.form.password) payload.password = this.form.password;

      return payload;
    },

    async submit() {
      if (!this.$refs.form.validate()) return;

      this.saving = true;
      this.serverErrors = {};
      this.generalError = '';

      try {
        const payload = this.buildPayload();
        const saved = this.isEditing
          ? await userService.update(this.user.id, payload)
          : await userService.create(payload);

        this.$emit('saved', saved, this.isEditing);
        this.isOpen = false;
      } catch (error) {
        const fieldErrors = error.fieldErrors || {};
        if (Object.keys(fieldErrors).length) this.serverErrors = fieldErrors;
        else this.generalError = error.message;
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
.dialog__sub {
  font-size: 0.78125rem;
  color: var(--pos-text-faint);
  margin-top: 1px;
  line-height: 1.4;
}

.dialog__note {
  font-size: 0.78125rem;
  color: var(--pos-text-faint);
}

.pos-role-select {
  max-width: 180px;
}
</style>
