const { toCents, fromCents, toAmountString, isValidAmount } = require('../../src/utils/money');

describe('toCents', () => {
  it('convierte montos con y sin decimales', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('20')).toBe(2000);
    expect(toCents(0.1)).toBe(10);
  });

  it('rescata los números afectados por error de punto flotante', () => {
    // 19.99 * 100 === 1998.9999999999998 en coma flotante binaria.
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.29)).toBe(29);
  });



  it('admite montos sin parte entera o sin decimales', () => {
    expect(toCents('.5')).toBe(50);
    expect(toCents('7.')).toBe(700);
  });

  it('devuelve null ante valores no numéricos', () => {
    expect(toCents('abc')).toBeNull();
    expect(toCents(null)).toBeNull();
    expect(toCents(undefined)).toBeNull();
    expect(toCents('')).toBeNull();
    expect(toCents(Infinity)).toBeNull();
  });
});

describe('fromCents', () => {
  it('formatea siempre con dos decimales', () => {
    expect(fromCents(1999)).toBe('19.99');
    expect(fromCents(2000)).toBe('20.00');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(0)).toBe('0.00');
  });

  it('conserva el signo negativo', () => {
    expect(fromCents(-150)).toBe('-1.50');
  });
});

describe('toAmountString', () => {
  it('normaliza cualquier entrada válida a string de dos decimales', () => {
    expect(toAmountString('7')).toBe('7.00');
    expect(toAmountString(7.5)).toBe('7.50');
    expect(toAmountString('  12.3  ')).toBe('12.30');
  });

  it('devuelve null si el valor no es un monto', () => {
    expect(toAmountString('x')).toBeNull();
  });
});

describe('isValidAmount', () => {
  it('acepta montos no negativos dentro del rango DECIMAL(10,2)', () => {
    expect(isValidAmount('0')).toBe(true);
    expect(isValidAmount('99999999.99')).toBe(true);
  });

  it('rechaza negativos, no numéricos y desbordes', () => {
    expect(isValidAmount('-0.01')).toBe(false);
    expect(isValidAmount('abc')).toBe(false);
    expect(isValidAmount('100000000.00')).toBe(false);
  });
});

describe('suma de importes en centavos', () => {
  it('no arrastra el error de coma flotante', () => {
    // 0.1 + 0.2 === 0.30000000000000004 con floats.
    const total = [toCents('0.10'), toCents('0.20')].reduce((a, b) => a + b, 0);
    expect(fromCents(total)).toBe('0.30');
  });

  it('mantiene la precisión sumando muchos importes', () => {
    const cents = Array.from({ length: 1000 }, () => toCents('0.07'));
    expect(fromCents(cents.reduce((a, b) => a + b, 0))).toBe('70.00');
  });
});
