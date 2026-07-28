const { Router } = require('express');
const { query } = require('express-validator');

const analytics = require('../services/analyticsService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { PERMISSIONS } = require('../config/roles');
const { toCents, fromCents } = require('../utils/money');

const router = Router();

router.use(authenticate);

/** Día anterior a la fecha dada, en formato AAAA-MM-DD. */
function diaAnterior(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Variación porcentual entre dos importes.
 * Devuelve null cuando la base es cero: "+∞%" no informa de nada.
 */
function variacion(actual, previo) {
  const a = toCents(actual) || 0;
  const p = toCents(previo) || 0;
  if (p === 0) return null;
  return Math.round(((a - p) / p) * 1000) / 10;
}

router.get(
  '/',
  authorize(PERMISSIONS.DASHBOARD_VIEW),
  [query('date').optional().isISO8601().withMessage('La fecha debe tener formato AAAA-MM-DD')],
  validate,
  asyncHandler(async (req, res) => {
    const { date } = analytics.rangoDelDia(req.query.date);
    const ayer = diaAnterior(date);

    // Se resuelven en paralelo: son consultas independientes y encadenarlas
    // multiplicaría el tiempo de respuesta del tablero sin necesidad.
    const [hoy, previo, porHora, topProductos, porCajero, actividad] = await Promise.all([
      analytics.resumen(date, date),
      analytics.resumen(ayer, ayer),
      analytics.ventasPorHora(date),
      analytics.productosMasVendidos(date, date, 6),
      analytics.ventasPorCajero(date, date),
      auditService.recent(12),
    ]);

    res.json({
      success: true,
      data: {
        date,
        timezone: analytics.TZ,
        summary: {
          ...hoy,
          previous: previo,
          change: {
            total: variacion(hoy.total, previo.total),
            ticketCount: variacion(hoy.ticketCount, previo.ticketCount),
            averageTicket: variacion(hoy.averageTicket, previo.averageTicket),
          },
        },
        salesByHour: porHora,
        topProducts: topProductos,
        salesByUser: porCajero,
        recentActivity: actividad,
      },
    });
  }),
);

/** Resumen de los últimos N días, para la tendencia del tablero. */
router.get(
  '/trend',
  authorize(PERMISSIONS.DASHBOARD_VIEW),
  [query('days').optional().isInt({ min: 2, max: 90 }).toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const dias = req.query.days || 14;
    const hasta = analytics.hoyLocal();
    const desde = (() => {
      const d = new Date(`${hasta}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - (dias - 1));
      return d.toISOString().slice(0, 10);
    })();

    const serie = await analytics.ventasPorDia(desde, hasta);

    // Se rellenan los días sin ventas: una serie con huecos deforma la gráfica.
    const porFecha = new Map(serie.map((p) => [p.date, p]));
    const completa = [];
    for (let i = 0; i < dias; i += 1) {
      const d = new Date(`${desde}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const clave = d.toISOString().slice(0, 10);
      completa.push(porFecha.get(clave) || { date: clave, total: fromCents(0), tickets: 0 });
    }

    res.json({ success: true, data: { from: desde, to: hasta, series: completa } });
  }),
);

module.exports = router;
