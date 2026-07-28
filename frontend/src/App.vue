<template>
  <v-app>
    <!-- La pantalla de inicio de sesión no lleva armazón: se muestra sola. -->
    <router-view v-if="isBlankLayout" />

    <template v-else>
      <v-navigation-drawer v-model="drawer" app :mini-variant="mini" :width="238" class="pos-nav">
        <div class="pos-nav__brand">
          <div class="pos-brand-plate">
            <img :src="brandMark" alt="InnovaB" class="pos-brand-plate__img" />
          </div>
          <div v-if="!mini" class="ml-3">
            <div class="pos-brand">Innova POS</div>
            <div class="pos-brand-sub">by InnovaB</div>
          </div>
        </div>

        <v-divider />

        <v-list nav dense class="pt-2">
          <v-list-item
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            link
            class="pos-nav__item"
          >
            <v-list-item-icon class="mr-3">
              <v-icon size="20">{{ item.icon }}</v-icon>
            </v-list-item-icon>
            <v-list-item-title>{{ item.title }}</v-list-item-title>
          </v-list-item>
        </v-list>

        <template #append>
          <v-divider />
          <div class="pos-nav__user">
            <v-avatar size="34" color="primary" class="flex-shrink-0">
              <span class="white--text font-weight-bold">{{ initials }}</span>
            </v-avatar>
            <div v-if="!mini" class="pos-nav__user-info">
              <div class="pos-nav__user-name">{{ user.name }}</div>
              <div class="pos-nav__user-role">{{ roleLabel }}</div>
            </div>
            <v-menu v-if="!mini" top offset-y>
              <template #activator="{ on, attrs }">
                <v-btn icon small v-bind="attrs" v-on="on">
                  <v-icon size="18">mdi-dots-vertical</v-icon>
                </v-btn>
              </template>
              <v-list dense>
                <v-list-item :to="{ name: 'account' }">
                  <v-list-item-icon class="mr-3"><v-icon size="18">mdi-account-circle-outline</v-icon></v-list-item-icon>
                  <v-list-item-title>Mi cuenta</v-list-item-title>
                </v-list-item>
                <v-list-item @click="logout">
                  <v-list-item-icon class="mr-3"><v-icon size="18">mdi-logout</v-icon></v-list-item-icon>
                  <v-list-item-title>Cerrar sesión</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-navigation-drawer>

      <v-app-bar app flat height="56" class="pos-appbar">
        <v-btn icon dark :title="mini ? 'Expandir menú' : 'Contraer menú'" @click="toggleNav">
          <v-icon size="21">mdi-menu</v-icon>
        </v-btn>
        <span class="pos-appbar__title ml-2">{{ pageTitle }}</span>

        <v-spacer />

        <div v-if="$route.name === 'pos'" class="d-none d-lg-flex align-center mr-4" style="gap: 14px">
          <span class="pos-shortcut-hint"><kbd class="pos-kbd">F2</kbd> Buscar</span>
          <span class="pos-shortcut-hint"><kbd class="pos-kbd">F9</kbd> Guardar venta</span>
        </div>

        <div
          class="pos-status mr-2"
          :class="apiOnline ? 'pos-status--online' : 'pos-status--offline'"
          :title="apiOnline ? 'La API responde correctamente' : 'Sin respuesta de la API'"
        >
          <span class="pos-status__dot" />
          {{ apiOnline ? 'En línea' : 'Sin conexión' }}
        </div>

        <v-btn icon dark :title="isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'" @click="toggleTheme">
          <v-icon size="20">{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
        </v-btn>
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
const NAV_STORAGE_KEY = 'innova-pos:nav-mini';

export default {
  name: 'App',

  data: () => ({
    brandMark,
    drawer: true,
    mini: false,
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

    /** Solo las rutas visibles para las que el usuario tiene permiso. */
    navItems() {
      return this.$router.options.routes
        .filter((route) => route.meta && !route.meta.public && !route.meta.hiddenInNav)
        .filter((route) => !route.meta.permission || session.can(route.meta.permission))
        .map((route) => ({
          name: route.name,
          title: route.meta.title,
          icon: route.meta.icon,
        }));
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
    // y se lleva al usuario al inicio de sesión sin dejarlo en una pantalla
    // que ya no puede usar.
    setSessionExpiredHandler((message) => this.onSessionExpired(message));

    try {
      this.mini = window.localStorage.getItem(NAV_STORAGE_KEY) === '1';
    } catch (error) {
      this.mini = false;
    }

    this.checkApiHealth({ silent: true });
    this.healthTimer = setInterval(() => this.checkApiHealth({ silent: true }), HEALTH_INTERVAL_MS);
  },

  beforeDestroy() {
    clearInterval(this.healthTimer);
  },

  methods: {
    toggleNav() {
      this.mini = !this.mini;
      try {
        window.localStorage.setItem(NAV_STORAGE_KEY, this.mini ? '1' : '0');
      } catch (error) {
        // Sin localStorage la preferencia no persiste; no es crítico.
      }
    },

    toggleTheme() {
      this.$vuetify.theme.dark = !this.$vuetify.theme.dark;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, this.$vuetify.theme.dark ? 'dark' : 'light');
      } catch (error) {
        // Igual que arriba: solo se pierde la persistencia.
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

.pos-appbar__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--pos-on-ink);
  letter-spacing: -0.01em;
}

.pos-nav {
  background: var(--pos-surface) !important;
  border-right: 1px solid var(--pos-border) !important;
}

.pos-nav__brand {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  height: 56px;
}

.pos-nav__item.v-list-item--active {
  background: var(--pos-primary-soft) !important;
  color: var(--pos-primary) !important;
}
.pos-nav__item .v-list-item__title {
  font-size: 0.875rem;
  font-weight: 550;
}

.pos-nav__user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
}
.pos-nav__user-info {
  min-width: 0;
  flex: 1 1 auto;
}
.pos-nav__user-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--pos-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pos-nav__user-role {
  font-size: 0.6875rem;
  color: var(--pos-text-faint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.pos-brand-plate {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: #ffffff;
  border: 1px solid var(--pos-border);
  display: grid;
  place-items: center;
  padding: 4px;
  flex: 0 0 auto;
}
.pos-brand-plate__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.pos-brand {
  font-weight: 700;
  font-size: 0.9375rem;
  letter-spacing: -0.02em;
  color: var(--pos-text);
  line-height: 1.2;
}
.pos-brand-sub {
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pos-text-faint);
  line-height: 1;
}

.pos-shortcut-hint {
  font-size: 0.75rem;
  color: var(--pos-on-ink-muted);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.pos-shortcut-hint .pos-kbd {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
  color: #cbd5e1;
}
</style>
