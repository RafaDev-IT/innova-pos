/**
 * Codificación gráfica de un EAN-13.
 *
 * Se implementa aquí en lugar de traer una librería de códigos de barras: la
 * norma cabe en unas pocas tablas, el resultado es un SVG nítido a cualquier
 * tamaño y se evita una dependencia de decenas de kilobytes para dibujar
 * rectángulos.
 *
 * Estructura de los 95 módulos: guarda inicial (101), seis dígitos de siete
 * módulos, guarda central (01010), otros seis dígitos y guarda final (101).
 */

import { isValidEan13 } from './barcode';

// Cada dígito se codifica con siete módulos. El grupo izquierdo alterna entre
// las tablas L y G según la paridad que marca el primer dígito —así es como un
// EAN-13 mete trece dígitos en el espacio de doce— y el derecho usa siempre R.
const L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];

const G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];

const R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];

/** Qué tabla usa cada posición del grupo izquierdo, según el primer dígito. */
const PARIDAD = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

const GUARDA_LATERAL = '101';
const GUARDA_CENTRAL = '01010';

/**
 * Convierte el código en su cadena de 95 módulos.
 * @returns {string|null} null si el código no es un EAN-13 válido.
 */
export function encodeEan13(codigo) {
  const texto = String(codigo || '').trim();
  if (!isValidEan13(texto)) return null;

  const digitos = texto.split('').map(Number);
  const patron = PARIDAD[digitos[0]];

  let modulos = GUARDA_LATERAL;

  // Dígitos 2 a 7: el primero no se dibuja, viaja codificado en la paridad.
  for (let i = 0; i < 6; i += 1) {
    const tabla = patron[i] === 'L' ? L : G;
    modulos += tabla[digitos[i + 1]];
  }

  modulos += GUARDA_CENTRAL;

  // Dígitos 8 a 13.
  for (let i = 7; i < 13; i += 1) {
    modulos += R[digitos[i]];
  }

  return modulos + GUARDA_LATERAL;
}

/**
 * Barras a dibujar, agrupando módulos contiguos del mismo valor.
 *
 * Agrupar reduce de noventa y cinco rectángulos a unos treinta, y evita las
 * costuras claras que aparecen entre rectángulos adyacentes al escalar.
 */
export function bars(codigo) {
  const modulos = encodeEan13(codigo);
  if (!modulos) return null;

  const resultado = [];
  let i = 0;

  while (i < modulos.length) {
    if (modulos[i] === '1') {
      let ancho = 1;
      while (modulos[i + ancho] === '1') ancho += 1;
      resultado.push({ x: i, width: ancho });
      i += ancho;
    } else {
      i += 1;
    }
  }

  return resultado;
}

/**
 * Las guardas se dibujan más largas que el resto, como en un código impreso:
 * es lo que delimita visualmente los grupos de dígitos.
 */
export function isGuardModule(x) {
  return (x >= 0 && x < 3) || (x >= 45 && x < 50) || (x >= 92 && x < 95);
}

export const TOTAL_MODULES = 95;

export default { encodeEan13, bars, isGuardModule, TOTAL_MODULES };
