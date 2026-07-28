const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const config = require('../config');
const { fromCents, toCents } = require('../utils/money');

/**
 * Consultas de análisis para el tablero y los reportes.
 *
 * Todas agregan en la zona horaria del negocio y no en UTC: un reporte por hora
 * debe responder "¿a qué hora vendió la tienda?". Sin convertir, la curva se
 * desplaza seis horas en México y el pico de la tarde aparece de madrugada.
 *
 * Las sumas se devuelven como string con dos decimales, igual que el resto de
 * la API, y los promedios se calculan en centavos enteros para no arrastrar
 * error de punto flotante.
 */

const TZ = config.businessTimezone;

/** Expresión SQL que lleva una marca de tiempo a la hora local del negocio. */
const local = (columna) => `(${columna} AT TIME ZONE '${TZ}')`;

/**
 * Fecha de hoy en la zona del negocio.
 *
 * `toISOString().slice(0,10)` daría la fecha UTC: a las 22:00 en México ya es
 * el día siguiente en UTC, y el tablero mostraría una jornada vacía justo
 * cuando la tienda aún está vendiendo.
 */
function hoyLocal() {
  // en-CA formatea como AAAA-MM-DD, que es exactamente lo que se necesita.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/** Rango [inicio, fin) de un día local, expresado en instantes UTC. */
function rangoDelDia(fecha) {
  const dia = fecha || hoyLocal();
  return {
    date: dia,
    from: sequelize.literal(`TIMESTAMP '${dia} 00:00:00' AT TIME ZONE '${TZ}'`),
    to: sequelize.literal(`TIMESTAMP '${dia} 00:00:00' AT TIME ZONE '${TZ}' + INTERVAL '1 day'`),
  };
}

/** Cláusula WHERE reutilizable para un rango de días locales. */
function whereRango(desde, hasta) {
  return `sold_at >= TIMESTAMP '${desde} 00:00:00' AT TIME ZONE '${TZ}'
      AND sold_at <  TIMESTAMP '${hasta} 00:00:00' AT TIME ZONE '${TZ}' + INTERVAL '1 day'
      AND status = 'completed'`;
}

/** Totales de un rango: facturado, tickets, artículos y ticket promedio. */
async function resumen(desde, hasta) {
  const [fila] = await sequelize.query(
    `SELECT COALESCE(SUM(total), 0) AS total,
            COUNT(*)               AS tickets,
            COALESCE(SUM(item_count), 0) AS articulos
       FROM sales
      WHERE ${whereRango(desde, hasta)}`,
    { type: QueryTypes.SELECT },
  );

  const totalCents = toCents(fila.total) || 0;
  const tickets = Number(fila.tickets);

  return {
    total: fromCents(totalCents),
    ticketCount: tickets,
    itemCount: Number(fila.articulos),
    // El promedio se calcula en centavos y se redondea una sola vez.
    averageTicket: fromCents(tickets ? Math.round(totalCents / tickets) : 0),
  };
}

/**
 * Ventas por hora del día indicado.
 *
 * Devuelve las 24 horas aunque no haya ventas: una serie con huecos hace que la
 * gráfica mienta sobre la forma de la jornada.
 */
async function ventasPorHora(fecha) {
  const { date } = rangoDelDia(fecha);

  const filas = await sequelize.query(
    `SELECT EXTRACT(HOUR FROM ${local('sold_at')})::int AS hora,
            COALESCE(SUM(total), 0) AS total,
            COUNT(*)                AS tickets
       FROM sales
      WHERE ${whereRango(date, date)}
      GROUP BY 1
      ORDER BY 1`,
    { type: QueryTypes.SELECT },
  );

  const porHora = new Map(filas.map((f) => [Number(f.hora), f]));

  return Array.from({ length: 24 }, (_, hora) => {
    const fila = porHora.get(hora);
    return {
      hour: hora,
      label: `${String(hora).padStart(2, '0')}:00`,
      total: fromCents(fila ? toCents(fila.total) : 0),
      tickets: fila ? Number(fila.tickets) : 0,
    };
  });
}

/** Ventas por día del rango, para la tendencia de los reportes. */
async function ventasPorDia(desde, hasta) {
  const filas = await sequelize.query(
    `SELECT ${local('sold_at')}::date AS dia,
            COALESCE(SUM(total), 0)   AS total,
            COUNT(*)                  AS tickets
       FROM sales
      WHERE ${whereRango(desde, hasta)}
      GROUP BY 1
      ORDER BY 1`,
    { type: QueryTypes.SELECT },
  );

  return filas.map((f) => ({
    date: f.dia instanceof Date ? f.dia.toISOString().slice(0, 10) : String(f.dia).slice(0, 10),
    total: fromCents(toCents(f.total)),
    tickets: Number(f.tickets),
  }));
}

/**
 * Productos más vendidos del rango.
 *
 * Se agrupa por el nombre copiado en el renglón y no por el producto actual:
 * así el reporte sigue siendo fiel aunque el producto se haya renombrado o
 * dado de baja después.
 */
async function productosMasVendidos(desde, hasta, limite = 8) {
  const filas = await sequelize.query(
    `SELECT si.product_id                AS id,
            si.product_name              AS nombre,
            si.product_barcode           AS codigo,
            SUM(si.quantity)::int        AS unidades,
            SUM(si.line_total)           AS total
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
      WHERE ${whereRango(desde, hasta).replace(/sold_at/g, 's.sold_at').replace(/status/g, 's.status')}
      GROUP BY si.product_id, si.product_name, si.product_barcode
      ORDER BY unidades DESC, total DESC
      LIMIT :limite`,
    { type: QueryTypes.SELECT, replacements: { limite: Math.min(Math.max(Number(limite) || 8, 1), 50) } },
  );

  return filas.map((f) => ({
    productId: f.id,
    name: f.nombre,
    barcode: f.codigo,
    quantity: Number(f.unidades),
    total: fromCents(toCents(f.total)),
  }));
}

/** Ventas agrupadas por cajero. */
async function ventasPorCajero(desde, hasta) {
  const filas = await sequelize.query(
    `SELECT user_id                  AS id,
            COALESCE(user_name, 'Sin asignar') AS nombre,
            COUNT(*)                 AS tickets,
            COALESCE(SUM(total), 0)  AS total,
            COALESCE(SUM(item_count), 0) AS articulos
       FROM sales
      WHERE ${whereRango(desde, hasta)}
      GROUP BY user_id, user_name
      ORDER BY total DESC`,
    { type: QueryTypes.SELECT },
  );

  return filas.map((f) => {
    const totalCents = toCents(f.total) || 0;
    const tickets = Number(f.tickets);
    return {
      userId: f.id,
      name: f.nombre,
      ticketCount: tickets,
      itemCount: Number(f.articulos),
      total: fromCents(totalCents),
      averageTicket: fromCents(tickets ? Math.round(totalCents / tickets) : 0),
    };
  });
}

/** Renglones con precio distinto al de catálogo, para revisión. */
async function preciosAjustados(desde, hasta, limite = 20) {
  const filas = await sequelize.query(
    `SELECT s.folio, s.sold_at, s.user_name,
            si.product_name, si.unit_price, si.quantity, p.price AS precio_catalogo
       FROM sale_items si
       JOIN sales s   ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
      WHERE ${whereRango(desde, hasta).replace(/sold_at/g, 's.sold_at').replace(/status/g, 's.status')}
        AND si.unit_price <> p.price
      ORDER BY s.sold_at DESC
      LIMIT :limite`,
    { type: QueryTypes.SELECT, replacements: { limite: Number(limite) || 20 } },
  );

  return filas.map((f) => ({
    folio: f.folio,
    soldAt: f.sold_at,
    userName: f.user_name,
    productName: f.product_name,
    unitPrice: fromCents(toCents(f.unit_price)),
    catalogPrice: fromCents(toCents(f.precio_catalogo)),
    quantity: Number(f.quantity),
  }));
}

module.exports = {
  TZ,
  hoyLocal,
  rangoDelDia,
  resumen,
  ventasPorHora,
  ventasPorDia,
  productosMasVendidos,
  ventasPorCajero,
  preciosAjustados,
};
