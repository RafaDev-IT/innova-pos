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

const DECIMAL_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/**
 * Parsea un string decimal sin pasar por punto flotante.
 *
 * Convertir a Number primero pierde información de forma irreversible:
 * Number('1.005') es en realidad 1.00499999999999989, y redondearlo da 100
 * centavos en lugar de 101. Operando sobre los dígitos del string se respeta
 * exactamente el importe que capturó el cajero.
 */
function parseDecimalString(raw) {
  const match = DECIMAL_PATTERN.exec(raw);
  if (!match) return null;

  const [, sign, intPart, fracPart] = match;
  // Debe haber al menos un dígito: '.', '' o '-' no son montos.
  if (!intPart && !fracPart) return null;

  const units = Number(intPart || '0');
  if (!Number.isFinite(units)) return null;

  const fraction = fracPart || '';
  let cents = units * CENTS_PER_UNIT + Number(fraction.slice(0, 2).padEnd(2, '0'));

  // Del tercer decimal en adelante se aplica redondeo comercial (half-up).
  if (Number(fraction.charAt(2) || '0') >= 5) cents += 1;

  return sign === '-' ? -cents : cents;
}

/**
 * Convierte un monto (string | number) a centavos enteros.
 * @returns {number|null} null si el valor no es un monto válido.
 */
function toCents(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : parseDecimalString(trimmed);
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  // Un `number` ya viene de un float y pudo perder precisión antes de llegar
  // aquí; por eso la API transporta los importes como string. Math.round es lo
  // mejor posible en este punto y rescata los casos habituales
  // (19.99 * 100 === 1998.9999999999998).
  return Math.round(value * CENTS_PER_UNIT);
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
