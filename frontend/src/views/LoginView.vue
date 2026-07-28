<template>
  <v-main class="login">
    <div class="login__split">
      <!-- Panel visual. Se oculta por completo en pantallas estrechas: en un
           móvil robaría el espacio que necesita el formulario. -->
      <aside class="login__visual" aria-hidden="true">
        <img :src="heroImage" alt="" class="login__photo" />
        <div class="login__scrim" />

        <div class="login__brand">
          <div class="brand-plate">
            <img :src="brandMark" alt="InnovaB" class="brand-plate__img" />
          </div>
          <div class="ml-3">
            <div class="login__brand-name">Innova POS</div>
            <div class="login__brand-sub">by InnovaB</div>
          </div>
        </div>

        <div class="login__claim">
          <p class="login__claim-title">Cobra rápido, cuadra sin sorpresas.</p>
          <p class="login__claim-text">
            Catálogo, ventas y corte de caja en una sola pantalla, con el historial de cada movimiento.
          </p>
        </div>
      </aside>

      <!-- Panel del formulario -->
      <section class="login__panel">
        <div class="login__form">
          <!-- La marca se repite aquí para cuando el panel visual no se muestra. -->
          <div class="login__brand login__brand--inline d-lg-none">
            <div class="brand-plate">
              <img :src="brandMark" alt="InnovaB" class="brand-plate__img" />
            </div>
            <div class="ml-3">
              <div class="brand__name">Innova POS</div>
              <div class="brand__sub">by InnovaB</div>
            </div>
          </div>

          <h1 class="login__title">Inicia sesión</h1>
          <p class="login__subtitle">Entra con tu usuario para comenzar el turno</p>

          <v-form ref="form" v-model="isFormValid" class="mt-7" @submit.prevent="submit">
            <v-text-field
              ref="usernameField"
              v-model="form.username"
              label="Usuario"
              outlined
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

            <v-btn type="submit" depressed block class="btn-primary btn-tall" :loading="loading">
              Entrar
            </v-btn>
          </v-form>

          <!-- Credenciales de ejemplo: este proyecto se entrega como prueba
               técnica y quien lo evalúe necesita poder entrar sin preguntar.
               Nunca se compilan en un build de producción: publicar la
               contraseña del administrador en la propia pantalla de acceso
               deja el sistema abierto a cualquiera. Para una demostración
               desplegada se activan con VITE_SHOW_DEMO_ACCOUNTS=true. -->
          <div v-if="mostrarCuentasDemo" class="login__demo">
            <div class="login__demo-title">Cuentas de ejemplo</div>
            <button
              v-for="cuenta in cuentasDemo"
              :key="cuenta.username"
              type="button"
              class="login__demo-row"
              @click="usarCuenta(cuenta)"
            >
              <span class="login__demo-role">{{ cuenta.label }}</span>
              <span class="login__demo-user">{{ cuenta.username }}</span>
              <v-icon size="15" color="primary">mdi-arrow-right</v-icon>
            </button>
          </div>

          <p class="login__foot">Innova POS · El Salvador</p>
        </div>
      </section>
    </div>
  </v-main>
</template>

<script>
import session from '@/store/session';
import http from '@/services/http';
import brandMark from '@/assets/innovab-mark.png';
import heroImage from '@/assets/login-pos.jpg';

/**
 * Atajos de acceso para evaluar el sistema sin pedir credenciales.
 *
 * La condición se evalúa al compilar: Vite sustituye `import.meta.env.DEV` por
 * `false` en un build de producción, el ternario se pliega a `[]` y las
 * contraseñas desaparecen del bundle. Dejarlas en `data()` con un `v-if` en la
 * plantilla las ocultaría de la pantalla pero seguirían legibles en el
 * JavaScript servido, que es exactamente lo que hay que evitar.
 */
const CUENTAS_DEMO =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true'
    ? [
        { label: 'Administrador', username: 'admin', password: 'Admin.Innova2026' },
        { label: 'Supervisor', username: 'supervisor', password: 'Super.Innova2026' },
        { label: 'Cajero', username: 'cajero', password: 'Cajero.Innova2026' },
      ]
    : [];

export default {
  name: 'LoginView',

  data: () => ({
    brandMark,
    heroImage,
    form: { username: '', password: '' },
    isFormValid: false,
    showPassword: false,
    loading: false,
    generalError: '',
    apiOnline: true,
    cuentasDemo: CUENTAS_DEMO,
  }),

  computed: {
    mostrarCuentasDemo() {
      return this.cuentasDemo.length > 0;
    },

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
.login {
  background: var(--pos-surface);
}

.login__split {
  display: grid;
  /* 70 % para la fotografía y 30 % para el formulario, con un suelo de 400 px
     en la columna del formulario: en pantallas de 1280 px un 30 % puro dejaría
     los campos en 320 px, demasiado estrechos para escribir con comodidad. */
  grid-template-columns: 7fr minmax(400px, 3fr);
  min-height: 100vh;
}

/* --- Panel visual --------------------------------------------------------- */

.login__visual {
  position: relative;
  overflow: hidden;
  background: var(--pos-canvas);
}

.login__photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* El sujeto —la mano sobre la terminal— está ligeramente a la izquierda del
     centro, así que el recorte se ancla ahí y no se pierde al estrecharse. */
  object-position: 42% center;
}

/* Velo oscuro solo en la mitad inferior: la fotografía es clara y el texto
   blanco encima necesita contraste, pero cubrirla entera la apagaría. */
.login__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10, 16, 22, 0.34) 0%,
    rgba(10, 16, 22, 0.12) 32%,
    rgba(10, 16, 22, 0.58) 72%,
    rgba(10, 16, 22, 0.82) 100%
  );
}

.login__brand {
  position: absolute;
  top: 34px;
  left: 38px;
  display: flex;
  align-items: center;
}
.login__brand-name {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
  line-height: 1.15;
}
.login__brand-sub {
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}

.login__claim {
  position: absolute;
  left: 38px;
  right: 38px;
  bottom: 40px;
  max-width: 420px;
}
.login__claim-title {
  font-size: 1.5rem;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.28;
  color: #fff;
  margin: 0;
}
.login__claim-text {
  font-size: 0.875rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.82);
  margin: 10px 0 0;
}

/* --- Panel del formulario ------------------------------------------------- */

.login__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  background: var(--pos-surface);
}

.login__form {
  width: 100%;
  max-width: 366px;
}

.login__brand--inline {
  position: static;
  margin-bottom: 26px;
}

.login__title {
  font-size: 1.625rem;
  font-weight: 700;
  letter-spacing: -0.028em;
  color: var(--pos-text);
  margin: 0;
}

.login__subtitle {
  font-size: 0.875rem;
  color: var(--pos-text-faint);
  margin: 6px 0 0;
}

.login__demo {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--pos-border);
}
.login__demo-title {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pos-text-faint);
  margin-bottom: 9px;
}
.login__demo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 13px;
  border: 0;
  border-radius: var(--r-md);
  background: var(--pos-surface-2);
  margin-bottom: 7px;
  cursor: pointer;
  transition: background 0.14s ease;
}
.login__demo-row:hover {
  background: var(--pos-primary-soft);
}
.login__demo-role {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--pos-text);
  flex: 1 1 auto;
  text-align: left;
}
.login__demo-user {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.75rem;
  color: var(--pos-text-faint);
}

.login__foot {
  text-align: center;
  font-size: 0.75rem;
  color: var(--pos-text-faint);
  margin: 26px 0 0;
}

/* --- Adaptación ----------------------------------------------------------- */

/* La fotografía cede espacio antes de desaparecer, para que el formulario
   conserve un ancho cómodo en pantallas intermedias. */
@media (max-width: 1279px) {
  .login__claim-title {
    font-size: 1.25rem;
  }
  .login__claim-text {
    display: none;
  }
}

@media (max-width: 959px) {
  .login__split {
    grid-template-columns: 1fr;
  }
  .login__visual {
    display: none;
  }
  .login__panel {
    padding: 32px 24px;
  }
}
</style>
