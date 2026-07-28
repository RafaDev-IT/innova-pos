/**
 * Constantes de permisos, en espejo con `backend/src/config/roles.js`.
 *
 * Se duplican aquí a propósito en vez de pedirlas a la API: el router necesita
 * conocerlas para declarar sus rutas antes de que exista ninguna sesión. Los
 * permisos *efectivos* del usuario sí llegan del servidor al iniciar sesión;
 * esto es solo el vocabulario.
 *
 * Comprobarlos en el cliente sirve para ocultar botones y evitar navegaciones
 * inútiles. La protección real la aplica el backend en cada petición.
 */
export const PERMISSIONS = {
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',

  SALES_CREATE: 'sales.create',
  SALES_VIEW: 'sales.view',
  SALES_VIEW_ALL: 'sales.view_all',
  SALES_CANCEL: 'sales.cancel',

  CASH_OPERATE: 'cash.operate',
  CASH_VIEW_ALL: 'cash.view_all',

  DASHBOARD_VIEW: 'dashboard.view',
  REPORTS_VIEW: 'reports.view',

  USERS_MANAGE: 'users.manage',
  AUDIT_VIEW: 'audit.view',
};

export default PERMISSIONS;
