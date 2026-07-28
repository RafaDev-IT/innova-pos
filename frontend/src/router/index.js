import Vue from 'vue';
import VueRouter from 'vue-router';
import session from '@/store/session';
import { PERMISSIONS } from '@/config/permissions';

Vue.use(VueRouter);

/**
 * Rutas de la aplicación.
 *
 * `meta.permission` declara qué permiso exige cada pantalla. El guard lo
 * comprueba antes de navegar, pero es solo comodidad de interfaz: la protección
 * real la aplica el backend en cada petición.
 */
const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, layout: 'blank', title: 'Iniciar sesión' },
  },
  {
    path: '/',
    name: 'pos',
    component: () => import('@/views/PosView.vue'),
    meta: { permission: PERMISSIONS.SALES_CREATE, title: 'Punto de venta', icon: 'mdi-point-of-sale' },
  },
  {
    path: '/usuarios',
    name: 'users',
    component: () => import('@/views/UsersView.vue'),
    meta: { permission: PERMISSIONS.USERS_MANAGE, title: 'Usuarios', icon: 'mdi-account-group-outline' },
  },
  {
    path: '/cuenta',
    name: 'account',
    component: () => import('@/views/AccountView.vue'),
    meta: { title: 'Mi cuenta', icon: 'mdi-account-circle-outline', hiddenInNav: true },
  },
  {
    path: '/sin-permiso',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { title: 'Sin permiso', hiddenInNav: true },
  },
  { path: '*', redirect: '/' },
];

const router = new VueRouter({
  mode: 'history',
  routes,
});

/**
 * Guard de navegación.
 *
 * Antes de la primera navegación se intenta restaurar la sesión guardada; de lo
 * contrario, recargar la página en cualquier ruta rebotaría al inicio de sesión
 * aunque el token siguiera siendo válido.
 */
router.beforeEach(async (to, from, next) => {
  if (!session.state.restored) {
    await session.restore();
  }

  if (to.meta.public) {
    // Con sesión abierta, la pantalla de inicio de sesión no tiene sentido.
    return session.isAuthenticated ? next({ name: 'pos' }) : next();
  }

  if (!session.isAuthenticated) {
    // Se recuerda el destino para volver a él tras iniciar sesión.
    return next({ name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } });
  }

  if (to.meta.permission && !session.can(to.meta.permission)) {
    return next({ name: 'forbidden' });
  }

  return next();
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Innova POS` : 'Innova POS';
});

export default router;
