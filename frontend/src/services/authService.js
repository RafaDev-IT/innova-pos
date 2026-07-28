import http from './http';
import { getToken, setToken } from './token';

const PERFIL_KEY = 'innova-pos:perfil';

/**
 * Copia local del perfil con el que se abrió la sesión.
 *
 * Solo se usa cuando no hay conexión para verificar el token. No sustituye a la
 * comprobación del servidor: los permisos se aplican en la API, y aquí sirven
 * únicamente para dibujar la interfaz.
 */
function guardarPerfil(datos) {
  try {
    window.localStorage.setItem(PERFIL_KEY, JSON.stringify(datos));
  } catch (error) {
    // Sin localStorage no hay sesión sin conexión, y no pasa nada más.
  }
}

function leerPerfil() {
  try {
    const crudo = window.localStorage.getItem(PERFIL_KEY);
    return crudo ? JSON.parse(crudo) : null;
  } catch (error) {
    return null;
  }
}

function borrarPerfil() {
  try {
    window.localStorage.removeItem(PERFIL_KEY);
  } catch (error) {
    // Nada que hacer.
  }
}

/**
 * Operaciones de sesión contra la API. El almacenamiento del token vive en
 * `token.js`, compartido con el cliente HTTP.
 */
export default {
  async login(credentials) {
    const response = await http.post('/auth/login', credentials);
    setToken(response.data.token);
    guardarPerfil(response.data);
    return response.data;
  },

  /** Recupera la sesión guardada. Devuelve null si no hay o ya no es válida. */
  async restore() {
    if (!getToken()) return null;
    try {
      const response = await http.get('/auth/me');
      guardarPerfil(response.data);
      return response.data;
    } catch (error) {
      if (error.offline) {
        /*
         * Sin red no se puede saber si el token sigue siendo válido, y
         * asumir que no lo es tiene un coste alto: expulsa una sesión buena a
         * una pantalla de acceso que tampoco funciona sin conexión, dejando al
         * cajero fuera hasta que vuelva Internet. Se conserva el perfil
         * guardado; en cuanto haya red, la siguiente petición revalidará el
         * token y lo cerrará si de verdad caducó.
         */
        return leerPerfil();
      }

      // Rechazo real del servidor: token caducado, cuenta desactivada o rol
      // revocado. Ahí sí se descarta.
      setToken(null);
      borrarPerfil();
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
      borrarPerfil();
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
