import { describe, it, expect } from 'vitest';
import { ApiRequestError } from '@/services/http';

describe('ApiRequestError', () => {
  it('expone los errores por campo en el formato que espera el formulario', () => {
    const error = new ApiRequestError('Datos inválidos', {
      status: 422,
      details: [
        { field: 'barcode', message: 'Ya está registrado' },
        { field: 'price', message: 'No puede ser negativo' },
      ],
    });

    expect(error.fieldErrors).toEqual({
      barcode: 'Ya está registrado',
      price: 'No puede ser negativo',
    });
  });

  it('devuelve un objeto vacío cuando el error no trae detalles por campo', () => {
    expect(new ApiRequestError('Falló').fieldErrors).toEqual({});
  });

  it('marca por defecto el error como no relacionado con la conexión', () => {
    expect(new ApiRequestError('Falló').offline).toBe(false);
  });

  it('permite marcar el error como de conexión', () => {
    // Distinguirlo importa: App.vue revalida el estado de la API solo en ese caso.
    expect(new ApiRequestError('Sin red', { offline: true }).offline).toBe(true);
  });
});
