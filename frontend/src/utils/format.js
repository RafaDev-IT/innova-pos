const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un monto para mostrarlo. La API entrega los importes como string
 * ("19.90") para no perder precisión; aquí solo se convierte para presentación,
 * nunca para calcular.
 */
export function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return currencyFormatter.format(0);
  return currencyFormatter.format(numeric);
}

/**
 * Normaliza un monto a string con dos decimales antes de enviarlo a la API.
 */
export function toAmountString(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toFixed(2);
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
