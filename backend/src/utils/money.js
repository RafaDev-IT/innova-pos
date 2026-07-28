/**
 * Utilidades monetarias.
 *
 * Todo el dinero se almacena en Postgres como DECIMAL(10,2) y viaja por la API
 * como string ("19.90"). Las sumas y multiplicaciones se hacen en centavos
 * enteros: operar con floats produce errores acumulados (0.1 + 0.2 === 0.30000000000000004)
 * que en un POS se traducen en totales descuadrados.
 */

const CENTS_PER_UNIT = 100;
const MAX_AMOUNT = 99999999.99; // Límite de DECIMAL(10,2).

/**
 * Convierte un monto (string | number) a centavos enteros.
 * @returns {number|null} null si el valor no es un monto válido.
 */
function toCents(value) {
  if (value === null || value === undefined || value === '') return null;

  const normalized = typeof value === 'string' ? value.trim() : value;
  const numeric = Number(normalized);

  if (!Number.isFinite(numeric)) return null;

  // Math.round evita que 19.99 * 100 === 1998.9999999999998 se trunque a 1998.
  return Math.round(numeric * CENTS_PER_UNIT);
}

/**
 * Convierte centavos enteros al string decimal que espera la base de datos.
 */
function fromCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const units = Math.floor(abs / CENTS_PER_UNIT);
  const remainder = abs % CENTS_PER_UNIT;
  return `${sign}${units}.${String(remainder).padStart(2, '0')}`;
}

/**
 * Normaliza cualquier monto a string con exactamente dos decimales.
 */
function toAmountString(value) {
  const cents = toCents(value);
  return cents === null ? null : fromCents(cents);
}

/**
 * Valida que un monto sea un número finito, no negativo y dentro del rango
 * representable por DECIMAL(10,2).
 */
function isValidAmount(value) {
  const cents = toCents(value);
  if (cents === null) return false;
  if (cents < 0) return false;
  return cents <= Math.round(MAX_AMOUNT * CENTS_PER_UNIT);
}

module.exports = {
  CENTS_PER_UNIT,
  MAX_AMOUNT,
  toCents,
  fromCents,
  toAmountString,
  isValidAmount,
};
