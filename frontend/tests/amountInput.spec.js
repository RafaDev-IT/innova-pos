import { describe, it, expect } from 'vitest';
import { sanitizeAmountInput, hasValidPrecision } from '@/utils/money';

describe('sanitizeAmountInput', () => {
  it('deja pasar un importe correcto', () => {
    expect(sanitizeAmountInput('12.50')).toBe('12.50');
    expect(sanitizeAmountInput('0.75')).toBe('0.75');
  });

  it('elimina las letras', () => {
    expect(sanitizeAmountInput('12abc')).toBe('12');
    expect(sanitizeAmountInput('abc')).toBe('');
    expect(sanitizeAmountInput('1a2b.3c4')).toBe('12.34');
  });

  it('elimina símbolos y espacios', () => {
    expect(sanitizeAmountInput('$12.50')).toBe('12.50');
    expect(sanitizeAmountInput(' 7 . 5 0 ')).toBe('7.50');
    expect(sanitizeAmountInput('-8.00')).toBe('8.00');
  });

  it('acepta la coma decimal del teclado latino', () => {
    expect(sanitizeAmountInput('12,50')).toBe('12.50');
  });

  it('corta en dos decimales', () => {
    // Es el caso que motivó el cambio: antes se guardaba 3.00 sin avisar.
    expect(sanitizeAmountInput('2.99999')).toBe('2.99');
    expect(sanitizeAmountInput('1.005')).toBe('1.00');
  });

  it('admite otro número de decimales cuando se pide', () => {
    expect(sanitizeAmountInput('1.23456', 4)).toBe('1.2345');
    expect(sanitizeAmountInput('1.5', 0)).toBe('1.');
  });

  it('conserva un solo separador', () => {
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
    expect(sanitizeAmountInput('1,2,3')).toBe('1.23');
  });

  it('permite el separador final mientras se escribe', () => {
    // "12." es un estado intermedio legítimo: borrarlo impediría teclear.
    expect(sanitizeAmountInput('12.')).toBe('12.');
  });

  it('no rompe con entradas vacías o nulas', () => {
    expect(sanitizeAmountInput('')).toBe('');
    expect(sanitizeAmountInput(null)).toBe('');
    expect(sanitizeAmountInput(undefined)).toBe('');
  });

  it('acepta importes sin parte entera', () => {
    expect(sanitizeAmountInput('.75')).toBe('.75');
  });

  it('lo que devuelve siempre tiene precisión válida', () => {
    const entradas = ['2.99999', '1.005', '$18,50', 'abc12.3456', '0.1', '.999'];
    for (const entrada of entradas) {
      expect(hasValidPrecision(sanitizeAmountInput(entrada))).toBe(true);
    }
  });
});

describe('hasValidPrecision', () => {
  it('acepta hasta dos decimales', () => {
    expect(hasValidPrecision('12')).toBe(true);
    expect(hasValidPrecision('12.5')).toBe(true);
    expect(hasValidPrecision('12.50')).toBe(true);
  });

  it('rechaza tres o más', () => {
    expect(hasValidPrecision('12.505')).toBe(false);
    expect(hasValidPrecision('2.99999')).toBe(false);
  });

  it('entiende la coma decimal', () => {
    expect(hasValidPrecision('12,505')).toBe(false);
    expect(hasValidPrecision('12,50')).toBe(true);
  });

  it('no rompe con entradas vacías', () => {
    expect(hasValidPrecision('')).toBe(true);
    expect(hasValidPrecision(null)).toBe(true);
  });
});
