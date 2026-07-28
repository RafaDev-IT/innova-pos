import http from './http';
import { getToken, setToken } from './token';

/**
 * Operaciones de sesión contra la API. El almacenamiento del token vive en
 * `token.js`, compartido con el cliente HTTP.
 */
export default {
  async login(credentials) {
    const response = await http.post('/auth/login', credentials);
    setToken(response.data.token);
    return response.data;
  },

  /** Recupera la sesión guardada. Devuelve null si no hay o ya no es válida. */
  async restore() {
    if (!getToken()) return null;
    try {
      const response = await http.get('/auth/me');
      return response.data;
    } catch (error) {
      // Token caducado, cuenta desactivada o rol revocado: se descarta.
      setToken(null);
      return null;
    }
  },

  async logout() {
    try {
      await http.post('/auth/logout');
    } catch (error) {
      // Si la API no responde, la sesión se cierra igualmente en el cliente:
      // dejar al usuario dentro sería peor que perder el registro del cierre.
    } finally {
      setToken(null);
    }
  },

  async changePassword(payload) {
    const response = await http.post('/auth/change-password', payload);
    return response.data;
  },

  async roles() {
    const response = await http.get('/auth/roles');
    return response.data;
  },
};
