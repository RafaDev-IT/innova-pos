<template>
  <v-app>
    <!-- La pantalla de inicio de sesión no lleva armazón: se muestra sola. -->
    <router-view v-if="isBlankLayout" />

    <template v-else>
      <v-navigation-drawer v-model="drawer" app :width="228" class="nav" floating>
        <div class="nav__brand">
          <div class="brand-plate">
            <img :src="brandMark" alt="InnovaB" class="brand-plate__img" />
          </div>
          <div class="ml-3">
            <div class="brand__name">Innova POS</div>
            <div class="brand__sub">by InnovaB</div>
          </div>
        </div>

        <nav class="nav__list">
          <router-link
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            class="nav__item"
            :class="{ 'nav__item--active': $route.name === item.name }"
          >
            <v-icon size="19" :color="$route.name === item.name ? 'white' : undefined">{{ item.icon }}</v-icon>
            {{ item.title }}
          </router-link>
        </nav>

        <template #append>
          <router-link :to="{ name: 'account' }" class="nav__user">
            <v-avatar size="32" color="primary" class="flex-shrink-0">
              <span class="white--text font-weight-bold text-caption">{{ initials }}</span>
            </v-avatar>
            <div class="flex-grow-1 min-width-0">
              <div class="nav__user-name">{{ user.name }}</div>
              <div class="nav__user-role">{{ roleLabel }}</div>
            </div>
          </router-link>

          <div class="nav__actions">
            <button type="button" class="nav__action" :title="isDark ? 'Tema claro' : 'Tema oscuro'" @click="toggleTheme">
              <v-icon size="18">{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
            </button>
            <button type="button" class="nav__action nav__action--danger" title="Cerrar sesión" @click="logout">
              <v-icon size="18">mdi-logout</v-icon>
              Salir
            </button>
          </div>
        </template>
      </v-navigation-drawer>

      <v-app-bar app flat height="64" class="topbar">
        <v-btn icon class="d-lg-none" @click="drawer = !drawer">
          <v-icon size="21">mdi-menu</v-icon>
        </v-btn>

        <div>
          <div class="topbar__title">{{ pageTitle }}</div>
          <div class="topbar__sub">{{ today }}</div>
        </div>

        <v-spacer />

        <span v-if="$route.name === 'pos'" class="d-none d-xl-inline-flex chip-soft mr-3">
          <kbd class="kbd">F2</kbd> buscar
          <kbd class="kbd ml-1">F9</kbd> cobrar
        </span>

        <span
          class="chip-soft"
          :class="apiOnline ? 'chip-green' : 'chip-red'"
          :title="apiOnline ? 'La API responde correctamente' : 'Sin respuesta de la API'"
        >
          <v-icon size="13" :color="apiOnline ? 'primary' : 'error'">
            {{ apiOnline ? 'mdi-check-circle' : 'mdi-alert-circle' }}
          </v-icon>
          {{ apiOnline ? 'En línea' : 'Sin conexión' }}
        </span>
      </v-app-bar>

      <v-main>
        <router-view @notify="notify($event)" @error="onModuleError($event)" />
      </v-main>
    </template>

    <v-snackbar v-model="notification.visible" :color="notification.color" :timeout="3600" bottom right>
      <div class="d-flex align-center">
        <v-icon small dark class="mr-2">{{ notificationIcon }}</v-icon>
        {{ notification.message }}
      </div>
      <template #action="{ attrs }">
        <v-btn text small v-bind="attrs" @click="notification.visible = false">Cerrar</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script>
import http, { setSessionExpiredHandler } from '@/services/http';
import session from '@/store/session';
import { THEME_STORAGE_KEY } from '@/plugins/vuetify';
import brandMark from '@/assets/innovab-mark.png';

const HEALTH_INTERVAL_MS = 15000;

export default {
  name: 'App',

  data: () => ({
    brandMark,
    drawer: true,
    apiOnline: false,
    healthTimer: null,
    notification: { visible: false, message: '', color: 'success' },
  }),

  computed: {
    isBlankLayout() {
      return this.$route.meta.layout === 'blank';
    },

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

    pageTitle() {
      return this.$route.meta.title || '';
    },

    today() {
      const texto = new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date());
      // Solo la inicial en mayúscula: `text-transform: capitalize` también
      // capitalizaría la preposición ("27 De Julio").
      return texto.charAt(0).toUpperCase() + texto.slice(1);
    },

    /** Solo las rutas visibles para las que el usuario tiene permiso. */
    navItems() {
      return this.$router.options.routes
        .filter((route) => route.meta && !route.meta.public && !route.meta.hiddenInNav)
        .filter((route) => !route.meta.permission || session.can(route.meta.permission))
        .map((route) => ({ name: route.name, title: route.meta.title, icon: route.meta.icon }));
    },

    isDark() {
      return this.$vuetify.theme.dark;
    },

    notificationIcon() {
      return { success: 'mdi-check-circle', error: 'mdi-alert-circle', info: 'mdi-information' }[
        this.notification.color
      ];
    },
  },

  created() {
    // Si el token deja de ser válido en cualquier momento, se limpia la sesión
    // y se lleva al usuario al inicio de sesión.
    setSessionExpiredHandler((message) => this.onSessionExpired(message));

    this.checkApiHealth({ silent: true });
    // El indicador se revalida periódicamente: comprobarlo solo al arrancar
    // haría que siguiera anunciando "En línea" tras caer la API.
    this.healthTimer = setInterval(() => this.checkApiHealth({ silent: true }), HEALTH_INTERVAL_MS);
  },

  beforeDestroy() {
    clearInterval(this.healthTimer);
  },

  methods: {
    toggleTheme() {
      this.$vuetify.theme.dark = !this.$vuetify.theme.dark;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, this.$vuetify.theme.dark ? 'dark' : 'light');
      } catch (error) {
        // Sin localStorage el tema no persiste entre sesiones; no es crítico.
      }
    },

    async logout() {
      await session.logout();
      this.$router.push({ name: 'login' });
    },

    onSessionExpired(message) {
      if (!session.isAuthenticated) return;
      session.clear();
      this.notify(message || 'Tu sesión expiró', 'error');
      if (this.$route.name !== 'login') {
        this.$router.push({ name: 'login', query: { redirect: this.$route.fullPath } });
      }
    },

    async checkApiHealth({ silent = false } = {}) {
      const estabaEnLinea = this.apiOnline;
      try {
        await http.get('/health');
        this.apiOnline = true;
        if (!estabaEnLinea && !silent) this.notify('Conexión con la API restablecida');
      } catch (error) {
        this.apiOnline = false;
        if (!silent) this.notify(error.message, 'error');
      }
    },

    notify(message, color = 'success') {
      this.notification = { visible: true, message, color };
    },

    onModuleError(error) {
      const message = typeof error === 'string' ? error : error.message;
      this.notify(message, 'error');

      const esDeConexion = typeof error === 'object' && error !== null && error.offline;
      if (esDeConexion || /no se pudo conectar/i.test(message)) {
        this.apiOnline = false;
        this.checkApiHealth({ silent: true });
      }
    },
  },
};
</script>

<style>
html {
  overflow-y: auto;
}

.min-width-0 {
  min-width: 0;
}

/* Barra superior integrada en el lienzo: sin sombra ni borde, para que la
   atención quede en las tarjetas y no en el marco. */
.topbar {
  background: transparent !important;
  box-shadow: none !important;
}
.topbar__title {
  font-size: 1.125rem;
  font-weight: 650;
  letter-spacing: -0.022em;
  color: var(--pos-text);
  line-height: 1.2;
}
.topbar__sub {
  font-size: 0.75rem;
  color: var(--pos-text-faint);
}

.nav__user {
  text-decoration: none;
  transition: background 0.14s ease;
}
.nav__user:hover {
  background: var(--pos-primary-soft);
}

.nav__actions {
  display: flex;
  gap: 8px;
  padding: 0 12px 14px;
}
.nav__action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  border: 0;
  border-radius: var(--r-md);
  background: var(--pos-surface-2);
  color: var(--pos-text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
  flex: 0 0 auto;
  width: 44px;
}
.nav__action--danger {
  flex: 1 1 auto;
  width: auto;
}
.nav__action:hover {
  background: var(--pos-border);
  color: var(--pos-text);
}
.nav__action--danger:hover {
  background: var(--pos-danger-soft);
  color: var(--pos-danger);
}
</style>
