import { describe, it, expect } from 'vitest';
import { toCents, fromCents, lineTotalCents, isValidPrice } from '@/utils/money';

describe('toCents', () => {
  it('convierte importes en string sin pasar por punto flotante', () => {
    expect(toCents('18.50')).toBe(1850);
    expect(toCents('1.005')).toBe(101);
    expect(toCents('0')).toBe(0);
  });

  it('acepta coma decimal', () => {
    expect(toCents('18,50')).toBe(1850);
  });

  it('devuelve null ante valores no numéricos', () => {
    expect(toCents('abc')).toBeNull();
    expect(toCents('')).toBeNull();
    expect(toCents(null)).toBeNull();
  });
});

describe('fromCents', () => {
  it('formatea siempre con dos decimales', () => {
    expect(fromCents(1850)).toBe('18.50');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(0)).toBe('0.00');
  });
});

describe('lineTotalCents', () => {
  it('multiplica precio por cantidad', () => {
    expect(lineTotalCents('18.50', 2)).toBe(3700);
    expect(lineTotalCents('0.07', 3)).toBe(21);
  });

  it('devuelve 0 si el precio es inválido', () => {
    expect(lineTotalCents('abc', 2)).toBe(0);
  });
});

describe('suma del carrito', () => {
  it('no arrastra error de punto flotante', () => {
    // 0.1 + 0.2 daría 0.30000000000000004 sumando como floats.
    const total = lineTotalCents('0.10', 1) + lineTotalCents('0.20', 1);
    expect(fromCents(total)).toBe('0.30');
  });

  it('mantiene la precisión con cien renglones', () => {
    const total = Array.from({ length: 100 }).reduce((sum) => sum + lineTotalCents('0.07', 1), 0);
    expect(fromCents(total)).toBe('7.00');
  });
});

describe('isValidPrice', () => {
  it('acepta importes no negativos', () => {
    expect(isValidPrice('0')).toBe(true);
    expect(isValidPrice('18.50')).toBe(true);
  });

  it('rechaza negativos y texto', () => {
    expect(isValidPrice('-1')).toBe(false);
    expect(isValidPrice('abc')).toBe(false);
  });
});
