<template>
  <v-container fluid class="pa-4 pos-page">
    <div class="panel mb-4">
      <header class="panel__head">
        <v-icon size="18" color="primary">mdi-account-circle-outline</v-icon>
        <span class="panel__title">Mi cuenta</span>
      </header>

      <div class="pa-4 d-flex align-center">
        <v-avatar size="52" color="primary" class="mr-4">
          <span class="white--text text-h6 font-weight-bold">{{ initials }}</span>
        </v-avatar>
        <div>
          <div class="pos-account__name">{{ user.name }}</div>
          <div class="pos-account__meta">
            <span class="code">{{ user.username }}</span>
            <span v-if="user.email"> · {{ user.email }}</span>
          </div>
          <span class="pos-role-chip mt-1">{{ roleLabel }}</span>
        </div>
      </div>

      <v-divider />

      <div class="pa-4">
        <div class="pos-account__row">
          <span>Último acceso</span>
          <strong>{{ user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Este es el primero' }}</strong>
        </div>
        <div class="pos-account__row">
          <span>Cuenta creada</span>
          <strong>{{ formatDateTime(user.createdAt) }}</strong>
        </div>
      </div>
    </div>

    <div class="panel">
      <header class="panel__head">
        <v-icon size="18" color="primary">mdi-lock-reset</v-icon>
        <span class="panel__title">Cambiar contraseña</span>
      </header>

      <div class="pa-4">
        <v-form ref="form" v-model="isFormValid" style="max-width: 420px" @submit.prevent="submit">
          <v-text-field
            v-model="form.currentPassword"
            label="Contraseña actual"
            type="password"
            outlined
            dense
            autocomplete="current-password"
            :rules="rules.currentPassword"
            :error-messages="serverErrors.currentPassword"
            @input="clearServerError('currentPassword')"
          />

          <v-text-field
            v-model="form.newPassword"
            label="Nueva contraseña"
            type="password"
            outlined
            dense
            autocomplete="new-password"
            :hint="`Mínimo ${MIN_PASSWORD} caracteres`"
            persistent-hint
            :rules="rules.newPassword"
            :error-messages="serverErrors.newPassword"
            @input="clearServerError('newPassword')"
          />

          <v-text-field
            v-model="form.confirmPassword"
            label="Repite la nueva contraseña"
            type="password"
            outlined
            dense
            class="mt-3"
            autocomplete="new-password"
            :rules="rules.confirmPassword"
          />

          <v-alert v-if="generalError" type="error" dense text class="mb-3">{{ generalError }}</v-alert>
          <v-alert v-if="successMessage" type="success" dense text class="mb-3">{{ successMessage }}</v-alert>

          <v-btn type="submit" depressed class="btn-primary" :loading="saving">Actualizar contraseña</v-btn>
        </v-form>
      </div>
    </div>
  </v-container>
</template>

<script>
import session from '@/store/session';
import authService from '@/services/authService';
import { formatDateTime } from '@/utils/format';

const MIN_PASSWORD = 12;

export default {
  name: 'AccountView',

  data: () => ({
    MIN_PASSWORD,
    form: { currentPassword: '', newPassword: '', confirmPassword: '' },
    isFormValid: false,
    saving: false,
    serverErrors: {},
    generalError: '',
    successMessage: '',
  }),

  computed: {
    user() {
      return session.state.user || {};
    },

    roleLabel() {
      return session.state.roleLabel;
    },

    initials() {
      return (this.user.name || '?')
        .split(' ')
        .slice(0, 2)
        .map((palabra) => palabra.charAt(0).toUpperCase())
        .join('');
    },

    rules() {
      return {
        currentPassword: [(v) => !!v || 'Indica tu contraseña actual'],
        newPassword: [
          (v) => !!v || 'Indica la nueva contraseña',
          (v) => (v || '').length >= MIN_PASSWORD || `Mínimo ${MIN_PASSWORD} caracteres`,
          (v) => v !== this.form.currentPassword || 'Debe ser distinta de la actual',
        ],
        confirmPassword: [(v) => v === this.form.newPassword || 'Las contraseñas no coinciden'],
      };
    },
  },

  methods: {
    formatDateTime,

    clearServerError(field) {
      if (this.serverErrors[field]) this.$delete(this.serverErrors, field);
      this.generalError = '';
      this.successMessage = '';
    },

    async submit() {
      if (!this.$refs.form.validate()) return;

      this.saving = true;
      this.serverErrors = {};
      this.generalError = '';
      this.successMessage = '';

      try {
        await authService.changePassword({
          currentPassword: this.form.currentPassword,
          newPassword: this.form.newPassword,
        });

        this.successMessage = 'Tu contraseña se actualizó correctamente';
        this.form = { currentPassword: '', newPassword: '', confirmPassword: '' };
        this.$refs.form.resetValidation();
        this.$emit('notify', 'Contraseña actualizada');
      } catch (error) {
        const fieldErrors = error.fieldErrors || {};
        if (Object.keys(fieldErrors).length) this.serverErrors = fieldErrors;
        else this.generalError = error.message;
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.pos-page {
  max-width: 760px;
}

.pos-account__name {
  font-size: 1.0625rem;
  font-weight: 650;
  color: var(--pos-text);
}
.pos-account__meta {
  font-size: 0.8125rem;
  color: var(--pos-text-faint);
  margin-top: 2px;
}

.pos-account__row {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 0.875rem;
  color: var(--pos-text-muted);
}
.pos-account__row strong {
  color: var(--pos-text);
  font-weight: 600;
}

.pos-role-chip {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--pos-primary-soft);
  color: var(--pos-primary);
}
</style>
