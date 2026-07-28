/**
 * Roles y permisos del sistema.
 *
 * Los permisos se declaran aquí, en un solo lugar, y tanto el backend como el
 * frontend consultan esta misma definición (el frontend la recibe al iniciar
 * sesión). Repartir comprobaciones de rol por los controladores termina en
 * reglas contradictorias imposibles de auditar.
 *
 * La autorización real siempre ocurre en el servidor: lo que el frontend hace
 * con estos permisos es ocultar botones, nunca proteger datos.
 */

const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  CASHIER: 'cashier',
};

const PERMISSIONS = {
  // Catálogo
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',

  // Venta
  SALES_CREATE: 'sales.create',
  SALES_VIEW: 'sales.view',
  SALES_VIEW_ALL: 'sales.view_all', // Ventas de todos los cajeros, no solo las propias
  SALES_CANCEL: 'sales.cancel',

  // Caja
  CASH_OPERATE: 'cash.operate', // Abrir y cerrar el turno propio
  CASH_VIEW_ALL: 'cash.view_all', // Ver los cortes de todos los cajeros

  // Análisis
  DASHBOARD_VIEW: 'dashboard.view',
  REPORTS_VIEW: 'reports.view',

  // Administración
  USERS_MANAGE: 'users.manage',
  AUDIT_VIEW: 'audit.view',
};

const P = PERMISSIONS;

/**
 * Un cajero solo vende y consulta el catálogo. Un supervisor además cancela
 * ventas, revisa los cortes de todos y consulta reportes. El administrador
 * gestiona usuarios y ve la bitácora.
 */
const ROLE_PERMISSIONS = {
  [ROLES.CASHIER]: [P.PRODUCTS_VIEW, P.SALES_CREATE, P.SALES_VIEW, P.CASH_OPERATE],

  [ROLES.SUPERVISOR]: [
    P.PRODUCTS_VIEW,
    P.PRODUCTS_MANAGE,
    P.SALES_CREATE,
    P.SALES_VIEW,
    P.SALES_VIEW_ALL,
    P.SALES_CANCEL,
    P.CASH_OPERATE,
    P.CASH_VIEW_ALL,
    P.DASHBOARD_VIEW,
    P.REPORTS_VIEW,
  ],

  [ROLES.ADMIN]: Object.values(PERMISSIONS),
};

const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.CASHIER]: 'Cajero',
};

/** Permisos efectivos de un rol. Un rol desconocido no obtiene ninguno. */
function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, permission) {
  return permissionsFor(role).includes(permission);
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  permissionsFor,
  hasPermission,
};
