const TOKEN_KEY = 'innova-pos:token';

/**
 * Almacenamiento del token de sesión.
 *
 * Vive en su propio módulo —y no dentro de authService— porque el cliente HTTP
 * también necesita leerlo para firmar cada petición. Si estuviera en
 * authService, que a su vez usa el cliente HTTP, se formaría un ciclo de
 * importación.
 *
 * Se guarda en localStorage para que recargar la página no obligue a iniciar
 * sesión de nuevo. Una cookie httpOnly resistiría mejor un XSS, pero exige que
 * el frontend se sirva desde el mismo origen que la API, cosa que no ocurre
 * durante el desarrollo.
 */
export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    // Sin localStorage la sesión simplemente no sobrevive a la recarga.
  }
}

export function clearToken() {
  setToken(null);
}
