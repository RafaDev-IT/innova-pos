import { describe, it, expect } from 'vitest';
import { checkDigit, isValidEan13, generateEan13 } from '@/utils/barcode';

describe('checkDigit', () => {
  it('calcula el verificador de códigos reales conocidos', () => {
    // Códigos EAN-13 reales, verificados contra su dígito publicado.
    expect(checkDigit('400638133393')).toBe(1); // 4006381333931
    expect(checkDigit('501234567890')).toBe(0); // 5012345678900
    expect(checkDigit('978020137962')).toBe(4); // 9780201379624
  });

  it('ignora lo que venga después del duodécimo dígito', () => {
    expect(checkDigit('4006381333931')).toBe(checkDigit('400638133393'));
  });
});

describe('isValidEan13', () => {
  it('acepta códigos con verificador correcto', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('9780201379624')).toBe(true);
  });

  it('rechaza un verificador incorrecto', () => {
    // Mismo código con el último dígito alterado.
    expect(isValidEan13('4006381333932')).toBe(false);
  });

  it('rechaza longitudes distintas de trece', () => {
    expect(isValidEan13('400638133393')).toBe(false);
    expect(isValidEan13('40063813339311')).toBe(false);
  });

  it('rechaza texto no numérico', () => {
    expect(isValidEan13('ABC6381333931')).toBe(false);
    expect(isValidEan13('')).toBe(false);
    expect(isValidEan13(null)).toBe(false);
  });

  it('tolera espacios alrededor', () => {
    expect(isValidEan13('  4006381333931  ')).toBe(true);
  });
});

describe('generateEan13', () => {
  it('genera siempre un EAN-13 válido', () => {
    // Se repite muchas veces porque el fallo sería intermitente: un generador
    // que acierte el verificador nueve de cada diez veces pasaría una prueba
    // de una sola ejecución.
    for (let i = 0; i < 500; i += 1) {
      const codigo = generateEan13();
      expect(codigo).toMatch(/^\d{13}$/);
      expect(isValidEan13(codigo)).toBe(true);
    }
  });

  it('usa el prefijo de El Salvador por defecto', () => {
    expect(generateEan13().startsWith('741')).toBe(true);
  });

  it('admite otro prefijo de país', () => {
    expect(generateEan13('750').startsWith('750')).toBe(true);
    expect(isValidEan13(generateEan13('750'))).toBe(true);
  });

  it('produce códigos distintos entre llamadas', () => {
    const generados = new Set(Array.from({ length: 200 }, () => generateEan13()));
    // Con mil millones de combinaciones, doscientos repetidos sería un error
    // del generador, no mala suerte.
    expect(generados.size).toBeGreaterThan(195);
  });

  it('descarta caracteres no numéricos del prefijo', () => {
    const codigo = generateEan13('74-1');
    expect(codigo).toMatch(/^741\d{10}$/);
    expect(isValidEan13(codigo)).toBe(true);
  });
});
