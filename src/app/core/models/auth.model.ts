/**
 * Alineado con el endpoint real que construyó tu compañero:
 * `POST /auth` en `src/auth/auth.controller.ts` (repo de backend).
 *
 * Ese endpoint es intencionalmente básico por ahora:
 *   - Recibe { email, password }.
 *   - Si el usuario no existe: 400 Bad Request, body { message: 'Usuario no encontrado' }.
 *   - Si la contraseña es incorrecta: 401 Unauthorized, body { message: 'Error de credenciales' }.
 *   - Si todo es correcto: 200 OK, body `true` (sin token, sin datos del usuario).
 *
 * Como el backend no regresa nombre/correo ni token, el frontend arma el
 * objeto `usuario` con lo que la propia persona escribió en el formulario
 * (no hay nada que inventar del lado del servidor todavía). Si más adelante
 * el equipo agrega JWT y datos de usuario en la respuesta, sólo hay que
 * ampliar este modelo y `guardarSesion()` en auth.service.ts — el resto de
 * las pantallas no cambia.
 */
export interface LoginCredentials {
  usuario: string; // correo institucional
  password: string;
}

export interface AuthResponse {
  ok: boolean;
  mensaje: string;
  usuario?: {
    nombre: string;
    correo: string;
    rol: 'administrador';
  };
}
