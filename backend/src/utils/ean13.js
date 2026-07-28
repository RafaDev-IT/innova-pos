/**
 * Utilidades de código de barras EAN-13 en el servidor.
 *
 * El dígito verificador no es decorativo: un lector físico lo comprueba y
 * rechaza el código si no cuadra. Un catálogo con verificadores incorrectos se
 * ve bien en pantalla y falla en el mostrador, que es el peor momento para
 * descubrirlo.
 */

/**
 * Dígito verificador a partir de los primeros doce dígitos.
 *
 * Se suman las posiciones alternando factor 1 y 3 de izquierda a derecha; el
 * verificador es lo que falta para alcanzar la siguiente decena.
 */
function checkDigit(doce) {
  const suma = String(doce)
    .slice(0, 12)
    .split('')
    .reduce((acc, digito, i) => acc + Number(digito) * (i % 2 === 0 ? 1 : 3), 0);

  return (10 - (suma % 10)) % 10;
}

/** Completa un cuerpo de doce dígitos con su verificador. */
function withCheckDigit(doce) {
  const cuerpo = String(doce).replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
  return cuerpo + checkDigit(cuerpo);
}

/** Comprueba que un código sea un EAN-13 con verificador correcto. */
function isValidEan13(codigo) {
  const texto = String(codigo || '').trim();
  if (!/^\d{13}$/.test(texto)) return false;
  return Number(texto[12]) === checkDigit(texto);
}

module.exports = { checkDigit, withCheckDigit, isValidEan13 };
