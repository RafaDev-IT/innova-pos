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
  constructor(message, { status = null, details = null, cause = null, offline = false } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
    this.cause = cause;
    /** true cuando la petición no llegó a la API (red caída, timeout, backend abajo). */
    this.offline = offline;
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

const SIN_CONEXION = 'No se pudo conectar con el servidor. Verifica que la API esté ejecutándose.';

http.interceptors.response.use(
  // La API envuelve todo en { success, data }; devolvemos `data` directamente
  // para que los servicios no tengan que desempaquetar dos niveles.
  (response) => response.data,
  (error) => {
    const { response } = error;
    const payload = response && response.data;
    const apiError = payload && typeof payload === 'object' ? payload.error : null;

    // Error de negocio: la API respondió con su formato conocido.
    if (apiError) {
      return Promise.reject(
        new ApiRequestError(apiError.message || 'La solicitud no pudo completarse', {
          status: response.status,
          details: apiError.details || null,
          cause: error,
          offline: false,
        }),
      );
    }

    // Un 5xx sin el formato de la API significa que la petición no llegó al
    // backend: el proxy de desarrollo responde 500 cuando el destino está
    // caído, y un balanceador devolvería 502/503/504. Para el usuario esto es
    // un problema de conexión, no un error de sus datos.
    if (response && response.status >= 500) {
      return Promise.reject(new ApiRequestError(SIN_CONEXION, { status: response.status, cause: error, offline: true }));
    }

    if (response) {
      return Promise.reject(
        new ApiRequestError('La solicitud no pudo completarse', { status: response.status, cause: error }),
      );
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(
        new ApiRequestError('La solicitud tardó demasiado. Intenta de nuevo.', { cause: error, offline: true }),
      );
    }

    return Promise.reject(new ApiRequestError(SIN_CONEXION, { cause: error, offline: true }));
  },
);

export default http;
