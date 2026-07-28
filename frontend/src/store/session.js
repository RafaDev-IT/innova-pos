import Vue from 'vue';
import authService from '@/services/authService';

/**
 * Estado de sesión compartido.
 *
 * Se usa un objeto reactivo de Vue en lugar de Vuex: el estado global de esta
 * aplicación es solo el usuario en curso y sus permisos, y una dependencia
 * completa de gestión de estado para eso añade ceremonia sin resolver nada.
 */
const state = Vue.observable({
  user: null,
  permissions: [],
  roleLabel: '',
  restored: false,
  /**
   * Se levanta solo tras un inicio de sesión real, no al restaurar la sesión
   * guardada. Sirve para mostrar una sola vez el resumen de lo que el rol
   * permite: si se levantara también al restaurar, el diálogo reaparecería en
   * cada recarga de página y se volvería un estorbo.
   */
  justLoggedIn: false,
});

const session = {
  get state() {
    return state;
  },

  get user() {
    return state.user;
  },

  get isAuthenticated() {
    return Boolean(state.user);
  },

  /** Comprueba un permiso. Sirve para ocultar botones, no para proteger datos. */
  can(permission) {
    return state.permissions.includes(permission);
  },

  /** Comprueba varios permisos a la vez; basta con tener uno. */
  canAny(permissions = []) {
    return permissions.some((permission) => this.can(permission));
  },

  apply({ user, permissions, roleLabel }) {
    state.user = user;
    state.permissions = permissions || [];
    state.roleLabel = roleLabel || '';
  },

  clear() {
    state.user = null;
    state.permissions = [];
    state.roleLabel = '';
    state.justLoggedIn = false;
  },

  async login(credentials) {
    const data = await authService.login(credentials);
    this.apply(data);
    state.justLoggedIn = true;
    return data;
  },

  /** El resumen de permisos ya se mostró; no volver a abrirlo en esta sesión. */
  acknowledgeWelcome() {
    state.justLoggedIn = false;
  },

  /**
   * Restaura la sesión guardada al arrancar la aplicación. Se ejecuta una sola
   * vez: el guard del router espera a que termine antes de decidir.
   */
  async restore() {
    if (state.restored) return state.user;

    const data = await authService.restore();
    if (data) this.apply(data);
    state.restored = true;
    return state.user;
  },

  async logout() {
    await authService.logout();
    this.clear();
  },
};

export default session;
