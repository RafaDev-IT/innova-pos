/**
 * Aritmética monetaria en centavos enteros, en espejo con la del backend.
 *
 * El total mostrado en pantalla debe coincidir dígito a dígito con el que
 * calcula y persiste el servidor. Sumar precios como floats en el navegador
 * produce descuadres visibles (0.1 + 0.2 = 0.30000000000000004) justo en la
 * cifra que el cajero lee en voz alta.
 */

const CENTS_PER_UNIT = 100;
const DECIMAL_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/** Convierte un importe a centavos enteros; null si no es un monto válido. */
export function toCents(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * CENTS_PER_UNIT) : null;
  }

  const raw = String(value).trim().replace(',', '.');
  const match = DECIMAL_PATTERN.exec(raw);
  if (!match) return null;

  const [, sign, intPart, fracPart] = match;
  if (!intPart && !fracPart) return null;

  const fraction = fracPart || '';
  let cents = Number(intPart || '0') * CENTS_PER_UNIT + Number(fraction.slice(0, 2).padEnd(2, '0'));
  if (Number(fraction.charAt(2) || '0') >= 5) cents += 1;

  return sign === '-' ? -cents : cents;
}

/** Convierte centavos enteros a string con dos decimales. */
export function fromCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / CENTS_PER_UNIT)}.${String(abs % CENTS_PER_UNIT).padStart(2, '0')}`;
}

/** Importe de un renglón: precio unitario por cantidad, en centavos. */
export function lineTotalCents(unitPrice, quantity) {
  const cents = toCents(unitPrice);
  if (cents === null) return 0;
  return cents * (Number(quantity) || 0);
}

export function isValidPrice(value) {
  const cents = toCents(value);
  return cents !== null && cents >= 0;
}

/**
 * Limpia lo que el usuario teclea en un campo de importe.
 *
 * Filtrar mientras se escribe es preferible a corregir al enviar: el campo
 * nunca llega a mostrar algo que el sistema vaya a rechazar, y quien teclea
 * un tercer decimal ve que simplemente no entra, en vez de descubrir al
 * guardar que su precio cambió.
 *
 * Se conserva el punto o la coma final mientras se escribe ("12." es un estado
 * intermedio legítimo), y se admite la coma decimal del teclado latino.
 */
export function sanitizeAmountInput(raw, decimales = 2) {
  let texto = String(raw === null || raw === undefined ? '' : raw);

  // Solo dígitos y separadores decimales.
  texto = texto.replace(/[^\d.,]/g, '');

  // La coma se normaliza a punto, que es lo que espera la API.
  texto = texto.replace(/,/g, '.');

  // Un único separador: el primero manda, los demás se descartan.
  const partes = texto.split('.');
  if (partes.length > 2) {
    texto = `${partes.shift()}.${partes.join('')}`;
  }

  const [entera, decimal] = texto.split('.');
  if (decimal === undefined) return entera;

  return `${entera}.${decimal.slice(0, decimales)}`;
}

/** Comprueba que un importe no traiga más decimales de los admitidos. */
export function hasValidPrecision(value, decimales = 2) {
  const parte = String(value === null || value === undefined ? '' : value)
    .trim()
    .replace(',', '.')
    .split('.')[1];
  return parte === undefined || parte.length <= decimales;
}
