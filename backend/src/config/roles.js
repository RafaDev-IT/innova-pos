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

/**
 * Descripción de cada permiso en lenguaje llano, agrupada por área.
 *
 * Vive junto a la definición de permisos y no en el cliente, para que añadir un
 * permiso obligue a describirlo aquí mismo. Una lista de funciones mantenida
 * aparte se desincroniza en la primera prisa y acaba prometiendo cosas que el
 * sistema ya no hace.
 */
const PERMISSION_INFO = {
  [P.PRODUCTS_VIEW]: { group: 'Catálogo', label: 'Consultar el catálogo', detail: 'Buscar productos por nombre o código de barras' },
  [P.PRODUCTS_MANAGE]: { group: 'Catálogo', label: 'Administrar productos', detail: 'Dar de alta, editar precios y dar de baja' },

  [P.SALES_CREATE]: { group: 'Ventas', label: 'Registrar ventas', detail: 'Cobrar y guardar la venta, ajustando precios si hace falta' },
  [P.SALES_VIEW]: { group: 'Ventas', label: 'Consultar el historial', detail: 'Ver ventas registradas y su ticket' },
  [P.SALES_VIEW_ALL]: { group: 'Ventas', label: 'Ver las ventas de todos', detail: 'No solo las propias, sino las de cualquier cajero' },
  [P.SALES_CANCEL]: { group: 'Ventas', label: 'Anular ventas', detail: 'Cancelar una venta indicando el motivo' },

  [P.CASH_OPERATE]: { group: 'Caja', label: 'Operar su turno', detail: 'Abrir y cerrar su propio turno de caja' },
  [P.CASH_VIEW_ALL]: { group: 'Caja', label: 'Ver todos los cortes', detail: 'Revisar los turnos de cualquier cajero' },

  [P.DASHBOARD_VIEW]: { group: 'Análisis', label: 'Ver el tablero', detail: 'Indicadores del día, ventas por hora y más vendidos' },
  [P.REPORTS_VIEW]: { group: 'Análisis', label: 'Ver reportes', detail: 'Reportes por período y exportación a CSV' },

  [P.USERS_MANAGE]: { group: 'Administración', label: 'Gestionar usuarios', detail: 'Crear cuentas, asignar roles y dar de baja' },
  [P.AUDIT_VIEW]: { group: 'Administración', label: 'Consultar la bitácora', detail: 'Ver quién hizo qué y cuándo en el sistema' },
};

/** Resumen de un rol en una frase, para encabezar su ficha. */
const ROLE_SUMMARY = {
  [ROLES.ADMIN]: 'Acceso completo, incluida la gestión de usuarios y la bitácora del sistema.',
  [ROLES.SUPERVISOR]: 'Administra el catálogo, anula ventas y consulta el análisis del negocio.',
  [ROLES.CASHIER]: 'Atiende el mostrador: busca productos, cobra y opera su turno de caja.',
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

/** Ficha completa de un rol: etiqueta, resumen y permisos ya descritos. */
function describeRole(role) {
  return {
    value: role,
    label: ROLE_LABELS[role] || role,
    summary: ROLE_SUMMARY[role] || '',
    permissions: permissionsFor(role).map((permission) => ({
      key: permission,
      ...(PERMISSION_INFO[permission] || { group: 'Otros', label: permission, detail: '' }),
    })),
  };
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  PERMISSION_INFO,
  ROLE_SUMMARY,
  describeRole,
  permissionsFor,
  hasPermission,
};
