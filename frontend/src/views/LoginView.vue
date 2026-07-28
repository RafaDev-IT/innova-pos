<template>
  <v-main class="pos-login">
    <div class="pos-login__center">
      <div class="pos-login__panel">
      <div class="pos-login__card">
        <div class="pos-login__logo-plate">
          <img :src="brandLogo" alt="InnovaB" class="pos-login__logo" />
        </div>

        <h1 class="pos-login__title">Punto de venta</h1>
        <p class="pos-login__subtitle">Inicia sesión para comenzar tu turno</p>

        <v-form ref="form" v-model="isFormValid" class="mt-6" @submit.prevent="submit">
          <v-text-field
            ref="usernameField"
            v-model="form.username"
            label="Usuario"
            outlined
            dense
            autofocus
            autocomplete="username"
            prepend-inner-icon="mdi-account-outline"
            :rules="rules.username"
            :disabled="loading"
            @input="generalError = ''"
          />

          <v-text-field
            v-model="form.password"
            label="Contraseña"
            outlined
            dense
            autocomplete="current-password"
            prepend-inner-icon="mdi-lock-outline"
            :type="showPassword ? 'text' : 'password'"
            :append-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :rules="rules.password"
            :disabled="loading"
            @click:append="showPassword = !showPassword"
            @input="generalError = ''"
          />

          <v-alert v-if="generalError" type="error" dense text class="mb-4">
            {{ generalError }}
          </v-alert>

          <v-alert v-if="!apiOnline" type="warning" dense text class="mb-4">
            No hay respuesta de la API. Verifica que el servidor esté ejecutándose.
          </v-alert>

          <v-btn type="submit" depressed block large class="btn-primary" :loading="loading">
            Entrar
          </v-btn>
        </v-form>

        <!-- Credenciales de ejemplo: este proyecto se entrega como prueba
             técnica y quien lo evalúe necesita poder entrar sin preguntar. -->
        <div class="pos-login__demo">
          <div class="pos-login__demo-title">Cuentas de ejemplo</div>
          <button
            v-for="cuenta in cuentasDemo"
            :key="cuenta.username"
            type="button"
            class="pos-login__demo-row"
            @click="usarCuenta(cuenta)"
          >
            <span class="pos-login__demo-role">{{ cuenta.label }}</span>
            <span class="pos-login__demo-user">{{ cuenta.username }}</span>
            <v-icon size="14">mdi-arrow-right</v-icon>
          </button>
        </div>
      </div>

        <p class="pos-login__foot">Innova POS · InnovaB</p>
      </div>
    </div>
  </v-main>
</template>

<script>
import session from '@/store/session';
import http from '@/services/http';
import brandLogo from '@/assets/innovab-logo.png';

export default {
  name: 'LoginView',

  data: () => ({
    brandLogo,
    form: { username: '', password: '' },
    isFormValid: false,
    showPassword: false,
    loading: false,
    generalError: '',
    apiOnline: true,
    cuentasDemo: [
      { label: 'Administrador', username: 'admin', password: 'Admin.Innova2026' },
      { label: 'Supervisor', username: 'supervisor', password: 'Super.Innova2026' },
      { label: 'Cajero', username: 'cajero', password: 'Cajero.Innova2026' },
    ],
  }),

  computed: {
    rules() {
      return {
        username: [(v) => !!(v || '').trim() || 'Indica tu usuario'],
        password: [(v) => !!v || 'Indica tu contraseña'],
      };
    },
  },

  created() {
    this.checkApi();
  },

  methods: {
    async checkApi() {
      try {
        await http.get('/health');
        this.apiOnline = true;
      } catch (error) {
        // Distinguir "la API no responde" de "credenciales incorrectas" evita
        // que el cajero pierda tiempo reescribiendo una contraseña correcta.
        this.apiOnline = false;
      }
    },

    usarCuenta(cuenta) {
      this.form = { username: cuenta.username, password: cuenta.password };
      this.generalError = '';
    },

    async submit() {
      if (!this.$refs.form.validate()) return;

      this.loading = true;
      this.generalError = '';

      try {
        await session.login({ username: this.form.username.trim(), password: this.form.password });
        // Se vuelve al destino que el usuario intentaba abrir antes de que el
        // guard lo enviara aquí.
        const destino = this.$route.query.redirect || '/';
        this.$router.replace(destino);
      } catch (error) {
        this.generalError = error.message;
        this.form.password = '';
        if (error.offline) this.apiOnline = false;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.pos-login {
  background: var(--pos-bg);
}

.pos-login__center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.pos-login__panel {
  width: 100%;
  max-width: 400px;
  padding: 24px;
}

.pos-login__card {
  background: var(--pos-surface);
  border: 1px solid var(--pos-border);
  border-radius: var(--pos-r-lg);
  box-shadow: var(--pos-shadow);
  padding: 32px 28px 24px;
}

/* El logo está diseñado para fondos blancos: en tema oscuro su trazo gris
   pizarra desaparecería. Se le da su propia placa clara en lugar de
   recolorearlo. */
.pos-login__logo-plate {
  background: #ffffff;
  border-radius: var(--pos-r-md);
  padding: 14px 20px;
  margin: 0 auto 22px;
  width: fit-content;
}
.pos-login__logo {
  display: block;
  width: 176px;
  max-width: 100%;
}

.pos-login__title {
  font-size: 1.25rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  text-align: center;
  color: var(--pos-text);
  margin: 0;
}

.pos-login__subtitle {
  font-size: 0.875rem;
  color: var(--pos-text-faint);
  text-align: center;
  margin: 4px 0 0;
}

.pos-login__demo {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px dashed var(--pos-border-strong);
}
.pos-login__demo-title {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pos-text-faint);
  margin-bottom: 8px;
}
.pos-login__demo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--pos-border);
  border-radius: var(--pos-r-sm);
  background: var(--pos-surface-sunken);
  margin-bottom: 6px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.pos-login__demo-row:hover {
  border-color: var(--pos-primary);
  background: var(--pos-primary-soft);
}
.pos-login__demo-role {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--pos-text);
  flex: 1 1 auto;
  text-align: left;
}
.pos-login__demo-user {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.75rem;
  color: var(--pos-text-faint);
}

.pos-login__foot {
  text-align: center;
  font-size: 0.75rem;
  color: var(--pos-text-faint);
  margin: 18px 0 0;
}
</style>
