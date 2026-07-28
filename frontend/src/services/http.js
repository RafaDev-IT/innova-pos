import axios from 'axios';

/**
 * Cliente HTTP único de la aplicación.
 *
 * En desarrollo la baseURL es relativa (`/api`) y Vite hace de proxy hacia el
 * backend, evitando CORS. En producción se puede sobreescribir con
 * `VITE_API_BASE_URL` al momento del build.
 */
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Normaliza cualquier fallo (HTTP, red o timeout) a un objeto con la misma
 * forma, para que los componentes nunca tengan que inspeccionar `error.response`.
 */
export class ApiRequestError extends Error {
  constructor(message, { status = null, details = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
    this.cause = cause;
  }

  /** Errores de validación por campo, en el formato que espera Vuetify. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return this.details.reduce((acc, item) => {
      if (item && item.field) acc[item.field] = item.message;
      return acc;
    }, {});
  }
}

http.interceptors.response.use(
  // La API envuelve todo en { success, data }; devolvemos `data` directamente
  // para que los servicios no tengan que desempaquetar dos niveles.
  (response) => response.data,
  (error) => {
    if (error.response) {
      const payload = error.response.data || {};
      const apiError = payload.error || {};
      return Promise.reject(
        new ApiRequestError(apiError.message || 'La solicitud no pudo completarse', {
          status: error.response.status,
          details: apiError.details || null,
          cause: error,
        }),
      );
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(
        new ApiRequestError('La solicitud tardó demasiado. Intenta de nuevo.', { cause: error }),
      );
    }

    return Promise.reject(
      new ApiRequestError('No se pudo conectar con el servidor. Verifica que la API esté ejecutándose.', {
        cause: error,
      }),
    );
  },
);

export default http;
