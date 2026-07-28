/**
 * Formato de moneda, fecha y hora.
 *
 * El locale, la moneda y la zona horaria salen a variables de entorno para que
 * instalar el sistema en otro país no exija tocar código. Los valores por
 * defecto corresponden a El Salvador, que usa el dólar estadounidense.
 */
const LOCALE = import.meta.env.VITE_LOCALE || 'es-SV';
const CURRENCY = import.meta.env.VITE_CURRENCY || 'USD';
const TIMEZONE = import.meta.env.VITE_TIMEZONE || 'America/El_Salvador';

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un importe para mostrarlo. La API entrega los montos como string
 * ("19.90") para no perder precisión; aquí solo se convierte para presentación,
 * nunca para calcular.
 */
export function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return currencyFormatter.format(0);
  return currencyFormatter.format(numeric);
}

/**
 * Versión compacta para cifras grandes en tarjetas de indicador: $12.4K, $1.2M.
 * Por debajo de diez mil se usa el formato normal, que cabe de sobra.
 */
export function formatCurrencyCompact(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return currencyFormatter.format(0);
  if (Math.abs(numeric) < 10000) return currencyFormatter.format(numeric);

  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(numeric);
}

/** Normaliza un importe a string con dos decimales antes de enviarlo a la API. */
export function toAmountString(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toFixed(2);
}

export function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return new Intl.NumberFormat(LOCALE).format(numeric);
}

/**
 * Fecha y hora en la zona del negocio, no en la del navegador: un supervisor
 * revisando desde otro país debe ver la hora a la que vendió la tienda.
 */
export function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIMEZONE,
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(LOCALE, { timeStyle: 'short', timeZone: TIMEZONE }).format(
    new Date(value),
  );
}

export function formatDate(value) {
  if (!value) return '';
  // Una fecha suelta (AAAA-MM-DD) no lleva hora: se ancla a mediodía UTC para
  // que ningún desplazamiento de zona la mueva al día anterior.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: TIMEZONE }).format(fecha);
}

/** Distancia legible respecto a ahora: "hace 5 min", "hace 2 h". */
export function formatRelative(value) {
  if (!value) return '';
  const segundos = Math.round((Date.now() - new Date(value).getTime()) / 1000);

  if (segundos < 60) return 'hace un momento';
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;
  if (segundos < 172800) return 'ayer';
  return formatDate(value);
}
