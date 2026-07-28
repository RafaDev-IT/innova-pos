const { Router } = require('express');
const { query } = require('express-validator');

const analytics = require('../services/analyticsService');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const ApiError = require('../utils/ApiError');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { PERMISSIONS } = require('../config/roles');

const router = Router();

router.use(authenticate);

const MAX_DIAS = 366;

/** Valida y normaliza el rango pedido. */
function resolverRango(req) {
  const hoy = analytics.hoyLocal();
  const hasta = req.query.to || hoy;
  const desde =
    req.query.from ||
    (() => {
      const d = new Date(`${hasta}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 29);
      return d.toISOString().slice(0, 10);
    })();

  if (desde > hasta) {
    throw ApiError.badRequest('La fecha inicial no puede ser posterior a la final', [
      { field: 'from', message: 'Rango invertido' },
    ]);
  }

  const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1;
  if (dias > MAX_DIAS) {
    throw ApiError.badRequest(`El rango no puede superar ${MAX_DIAS} días`);
  }

  return { desde, hasta, dias };
}

const reglasRango = [
  query('from').optional().isISO8601().withMessage('Formato AAAA-MM-DD'),
  query('to').optional().isISO8601().withMessage('Formato AAAA-MM-DD'),
];

/** Reporte consolidado del rango. */
router.get(
  '/sales',
  authorize(PERMISSIONS.REPORTS_VIEW),
  reglasRango,
  validate,
  asyncHandler(async (req, res) => {
    const { desde, hasta, dias } = resolverRango(req);

    const [resumen, porDia, porProducto, porCajero, ajustados] = await Promise.all([
      analytics.resumen(desde, hasta),
      analytics.ventasPorDia(desde, hasta),
      analytics.productosMasVendidos(desde, hasta, 15),
      analytics.ventasPorCajero(desde, hasta),
      analytics.preciosAjustados(desde, hasta, 25),
    ]);

    // La serie se rellena para que la gráfica no invente continuidad donde hubo
    // días cerrados.
    const porFecha = new Map(porDia.map((p) => [p.date, p]));
    const serie = [];
    for (let i = 0; i < dias; i += 1) {
      const d = new Date(`${desde}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const clave = d.toISOString().slice(0, 10);
      serie.push(porFecha.get(clave) || { date: clave, total: '0.00', tickets: 0 });
    }

    res.json({
      success: true,
      data: {
        from: desde,
        to: hasta,
        days: dias,
        timezone: analytics.TZ,
        summary: resumen,
        byDay: serie,
        byProduct: porProducto,
        byUser: porCajero,
        adjustedPrices: ajustados,
      },
    });
  }),
);

/** Escapa un valor para CSV según RFC 4180. */
function celdaCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Exportación a CSV.
 *
 * Se usa punto y coma como separador y se antepone el BOM de UTF-8: Excel en
 * configuración regional española abre un CSV separado por comas en una sola
 * columna, y sin BOM rompe los acentos.
 */
router.get(
  '/sales.csv',
  authorize(PERMISSIONS.REPORTS_VIEW),
  reglasRango,
  validate,
  asyncHandler(async (req, res) => {
    const { desde, hasta } = resolverRango(req);
    const porDia = await analytics.ventasPorDia(desde, hasta);

    const filas = [
      ['Fecha', 'Tickets', 'Total'],
      ...porDia.map((d) => [d.date, d.tickets, d.total]),
    ];

    const csv = '﻿' + filas.map((fila) => fila.map(celdaCsv).join(';')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ventas_${desde}_${hasta}.csv"`);
    res.send(csv);
  }),
);

/** Exportación del detalle por producto. */
router.get(
  '/products.csv',
  authorize(PERMISSIONS.REPORTS_VIEW),
  reglasRango,
  validate,
  asyncHandler(async (req, res) => {
    const { desde, hasta } = resolverRango(req);
    const productos = await analytics.productosMasVendidos(desde, hasta, 500);

    const filas = [
      ['Producto', 'Código de barras', 'Unidades', 'Total'],
      ...productos.map((p) => [p.name, p.barcode, p.quantity, p.total]),
    ];

    const csv = '﻿' + filas.map((fila) => fila.map(celdaCsv).join(';')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="productos_${desde}_${hasta}.csv"`);
    res.send(csv);
  }),
);

module.exports = router;
