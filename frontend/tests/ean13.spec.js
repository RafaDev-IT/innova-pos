import { describe, it, expect } from 'vitest';
import { encodeEan13, bars, isGuardModule, TOTAL_MODULES } from '@/utils/ean13';
import { generateEan13 } from '@/utils/barcode';

describe('encodeEan13', () => {
  it('produce exactamente 95 módulos', () => {
    expect(encodeEan13('4006381333931')).toHaveLength(TOTAL_MODULES);
  });

  it('empieza y termina con la guarda lateral', () => {
    const modulos = encodeEan13('4006381333931');
    expect(modulos.slice(0, 3)).toBe('101');
    expect(modulos.slice(-3)).toBe('101');
  });

  it('lleva la guarda central en su posición', () => {
    const modulos = encodeEan13('4006381333931');
    expect(modulos.slice(45, 50)).toBe('01010');
  });

  it('codifica el ejemplo de la norma', () => {
    // 5901234123457 es el ejemplo publicado en la especificación EAN-13.
    // La cadena esperada se derivó a mano de las tablas L/G/R y del patrón de
    // paridad LGGLLG que impone su primer dígito, no de esta implementación.
    expect(encodeEan13('5901234123457')).toBe(
      '10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101',
    );
  });

  it('devuelve null si el código no es un EAN-13 válido', () => {
    expect(encodeEan13('4006381333932')).toBeNull(); // Verificador incorrecto.
    expect(encodeEan13('123')).toBeNull();
    expect(encodeEan13('INTERNO-042')).toBeNull();
    expect(encodeEan13('')).toBeNull();
  });

  it('codifica cualquier código que genere el sistema', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(encodeEan13(generateEan13())).toHaveLength(TOTAL_MODULES);
    }
  });

  it('el primer dígito no ocupa módulos: viaja en la paridad', () => {
    // Dos códigos que solo difieren en el primer dígito producen patrones
    // distintos aunque el resto de dígitos sea idéntico.
    const a = encodeEan13('0012345678905');
    const b = encodeEan13('4012345678901');
    expect(a).not.toBe(b);
    expect(a).toHaveLength(TOTAL_MODULES);
    expect(b).toHaveLength(TOTAL_MODULES);
  });
});

describe('bars', () => {
  it('agrupa los módulos contiguos en una sola barra', () => {
    const grupos = bars('4006381333931');
    // Agrupar reduce de 95 rectángulos a unas pocas decenas.
    expect(grupos.length).toBeLessThan(40);
    expect(grupos.length).toBeGreaterThan(20);
  });

  it('la suma de anchos coincide con los módulos negros', () => {
    const codigo = '4006381333931';
    const negros = encodeEan13(codigo).split('').filter((m) => m === '1').length;
    const suma = bars(codigo).reduce((acc, b) => acc + b.width, 0);
    expect(suma).toBe(negros);
  });

  it('ninguna barra se sale del ancho total', () => {
    for (const b of bars('4006381333931')) {
      expect(b.x + b.width).toBeLessThanOrEqual(TOTAL_MODULES);
    }
  });

  it('devuelve null ante un código no representable', () => {
    expect(bars('INTERNO-042')).toBeNull();
  });
});

describe('isGuardModule', () => {
  it('identifica las tres guardas', () => {
    expect(isGuardModule(0)).toBe(true); // Inicial
    expect(isGuardModule(47)).toBe(true); // Central
    expect(isGuardModule(94)).toBe(true); // Final
  });

  it('no marca los módulos de datos', () => {
    expect(isGuardModule(10)).toBe(false);
    expect(isGuardModule(60)).toBe(false);
  });
});
