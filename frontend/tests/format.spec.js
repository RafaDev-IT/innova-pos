import { describe, it, expect } from 'vitest';
import { formatCurrency, toAmountString } from '@/utils/format';

describe('formatCurrency', () => {
  it('formatea importes con dos decimales y símbolo de moneda', () => {
    expect(formatCurrency('18.5')).toContain('18.50');
    expect(formatCurrency(0)).toContain('0.00');
  });

  it('no rompe ante valores inválidos', () => {
    expect(formatCurrency('abc')).toContain('0.00');
    expect(formatCurrency(null)).toContain('0.00');
    expect(formatCurrency(undefined)).toContain('0.00');
  });
});

describe('toAmountString', () => {
  it('normaliza a dos decimales antes de enviar a la API', () => {
    expect(toAmountString('7')).toBe('7.00');
    expect(toAmountString(7.5)).toBe('7.50');
    expect(toAmountString('19.999')).toBe('20.00');
  });

  it('devuelve 0.00 ante entradas no numéricas', () => {
    expect(toAmountString('x')).toBe('0.00');
  });
});
