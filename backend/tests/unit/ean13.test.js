const { checkDigit, withCheckDigit, isValidEan13 } = require('../../src/utils/ean13');

describe('checkDigit', () => {
  it('calcula el verificador de códigos reales conocidos', () => {
    expect(checkDigit('400638133393')).toBe(1); // 4006381333931
    expect(checkDigit('978020137962')).toBe(4); // 9780201379624
    expect(checkDigit('590123412345')).toBe(7); // 5901234123457
  });
});

describe('withCheckDigit', () => {
  it('completa un cuerpo de doce dígitos', () => {
    expect(withCheckDigit('400638133393')).toBe('4006381333931');
  });

  it('el resultado siempre es un EAN-13 válido', () => {
    for (let i = 0; i < 300; i += 1) {
      const cuerpo = String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
      expect(isValidEan13(withCheckDigit(cuerpo))).toBe(true);
    }
  });

  it('descarta caracteres no numéricos', () => {
    expect(withCheckDigit('400-638-133-393')).toBe('4006381333931');
  });
});

describe('isValidEan13', () => {
  it('acepta verificadores correctos', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
  });

  it('rechaza verificadores incorrectos', () => {
    expect(isValidEan13('4006381333932')).toBe(false);
  });

  it('rechaza longitudes y formatos inválidos', () => {
    expect(isValidEan13('400638133393')).toBe(false);
    expect(isValidEan13('ABC6381333931')).toBe(false);
    expect(isValidEan13(null)).toBe(false);
  });
});

describe('catálogo de ejemplo', () => {
  // Los códigos del seeder se escribieron a mano en su primera versión y los
  // quince salieron con el verificador equivocado, lo que dejaba a todos los
  // productos sin representación gráfica. Esta prueba impide que vuelva a
  // ocurrir sin que nadie se entere.
  const seeder = require('../../src/database/seeders/20260727130000-demo-products.js');

  it('el seeder existe y expone su migración', () => {
    expect(typeof seeder.up).toBe('function');
  });

  it('todos los códigos que produce son EAN-13 válidos', async () => {
    const insertados = [];
    const queryInterfaceFalso = {
      bulkInsert: (_tabla, filas) => {
        insertados.push(...filas);
        return Promise.resolve();
      },
    };

    await seeder.up(queryInterfaceFalso);

    expect(insertados.length).toBeGreaterThan(0);
    for (const producto of insertados) {
      expect(isValidEan13(producto.barcode)).toBe(true);
    }
  });

  it('todos los códigos usan el prefijo de El Salvador', async () => {
    const insertados = [];
    await seeder.up({ bulkInsert: (_t, filas) => { insertados.push(...filas); return Promise.resolve(); } });

    for (const producto of insertados) {
      expect(producto.barcode.startsWith('741')).toBe(true);
    }
  });

  it('no hay códigos repetidos en el catálogo', async () => {
    const insertados = [];
    await seeder.up({ bulkInsert: (_t, filas) => { insertados.push(...filas); return Promise.resolve(); } });

    const codigos = insertados.map((p) => p.barcode);
    expect(new Set(codigos).size).toBe(codigos.length);
  });
});
