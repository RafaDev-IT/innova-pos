/**
 * Generación y validación de códigos de barras EAN-13.
 *
 * Muchos artículos de tienda no traen código impreso —granel, preparados,
 * empaques propios— y el campo es obligatorio. Generar uno al dar de alta
 * evita que el encargado tenga que inventarlo, y que acabe tecleando "123" en
 * media docena de productos.
 *
 * El código generado lleva su dígito verificador correcto: un EAN-13 inventado
 * sin verificador lo rechaza cualquier lector, así que "generar un número al
 * azar" sin calcularlo produciría códigos que no sirven en el mostrador.
 */

/** Prefijo que GS1 asigna a El Salvador. */
const PREFIJO_PAIS = '741';

/**
 * Dígito verificador de un EAN-13, a partir de sus primeros 12 dígitos.
 *
 * Se suman las posiciones alternando factor 1 y 3 de izquierda a derecha; el
 * verificador es lo que falta para llegar a la siguiente decena.
 */
export function checkDigit(doce) {
  const suma = String(doce)
    .slice(0, 12)
    .split('')
    .reduce((acc, digito, i) => acc + Number(digito) * (i % 2 === 0 ? 1 : 3), 0);

  return (10 - (suma % 10)) % 10;
}

/** Comprueba que un código sea un EAN-13 con verificador correcto. */
export function isValidEan13(codigo) {
  const texto = String(codigo || '').trim();
  if (!/^\d{13}$/.test(texto)) return false;
  return Number(texto[12]) === checkDigit(texto);
}

/**
 * Genera un EAN-13 válido con el prefijo del país.
 *
 * Los nueve dígitos centrales son aleatorios, lo que deja mil millones de
 * combinaciones: la probabilidad de chocar con un código ya existente en un
 * catálogo de tienda es despreciable, y si ocurriera el servidor lo rechaza
 * por la restricción de unicidad y basta con generar otro.
 */
export function generateEan13(prefijo = PREFIJO_PAIS) {
  const base = String(prefijo).replace(/\D/g, '').slice(0, 12);
  const faltan = 12 - base.length;

  let cuerpo = base;
  for (let i = 0; i < faltan; i += 1) {
    cuerpo += Math.floor(Math.random() * 10);
  }

  return cuerpo + checkDigit(cuerpo);
}

export default { checkDigit, isValidEan13, generateEan13, PREFIJO_PAIS };
