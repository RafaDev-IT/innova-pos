/**
 * Representación visual de un producto sin foto.
 *
 * Un comercio pequeño carga su catálogo antes de tener fotografías, así que la
 * rejilla tiene que verse bien igualmente. En lugar de repetir el mismo icono
 * gris en todas las tarjetas —que las vuelve indistinguibles— se genera un
 * tinte propio a partir del nombre: el mismo producto siempre obtiene el mismo
 * color, así que el cajero acaba reconociéndolo por su mancha de color antes de
 * leer el texto.
 */

// Tonos suaves y bien separados en el círculo cromático. Todos mantienen
// contraste suficiente con texto blanco encima.
const PALETTE = [
  ['#F0A44A', '#E8853B'],
  ['#5BA8F5', '#3D82D6'],
  ['#57C08D', '#38A06D'],
  ['#C88BE0', '#A662C4'],
  ['#F08A8A', '#D96565'],
  ['#5FBFC4', '#3E9CA1'],
  ['#E0B45C', '#C79539'],
  ['#8B9BF0', '#6675D6'],
];

/** Hash estable de una cadena. No es criptográfico: solo reparte de forma pareja. */
function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    value = (value << 5) - value + text.charCodeAt(i);
    value |= 0; // Fuerza a entero de 32 bits.
  }
  return Math.abs(value);
}

/** Degradado determinista para el producto. */
export function fallbackGradient(name = '') {
  const [from, to] = PALETTE[hash(name) % PALETTE.length];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

/**
 * Iniciales del producto, hasta dos letras.
 * Se omiten las palabras muy cortas ("de", "1 L") porque no ayudan a distinguir.
 */
export function initials(name = '') {
  const palabras = String(name)
    .split(/[\s-]+/)
    .filter((palabra) => palabra.length > 2 && /[a-zA-ZÁÉÍÓÚÑáéíóúñ]/.test(palabra.charAt(0)));

  if (!palabras.length) return String(name).trim().charAt(0).toUpperCase() || '?';

  return palabras
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}

export default { fallbackGradient, initials };
