import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API_URL } from '../config/api.config';
import { AuthResponse, LoginCredentials } from '../models/auth.model';

/**
 * AuthService — CONECTADO al endpoint real de tu compañero
 * ------------------------------------------------------------
 * Llama a `POST /auth` (NestJS). Ese endpoint es básico a propósito: sólo
 * valida `{ email, password }` contra la base de datos y responde `true`
 * si las credenciales son correctas, o un error 400/401 con `{ message }`
 * si no. No emite token ni regresa datos del usuario todavía — por eso
 * este servicio arma el objeto `usuario` con lo que la persona escribió en
 * el formulario, no con algo que venga del servidor.
 *
 * Si más adelante el equipo mejora el backend para regresar JWT + datos de
 * usuario, sólo hay que ajustar el `.pipe(map(...))` de abajo — el resto
 * de las pantallas (login, alertas) no necesita cambiar porque ya
 * consumen la interfaz `AuthResponse`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly SESSION_KEY = 'xmlflow_usuario';

  /** Señal reactiva con el usuario en sesión, consumible directamente en templates */
  readonly usuarioActual = signal<AuthResponse['usuario'] | null>(this.recuperarUsuario());

  login(credenciales: LoginCredentials): Observable<AuthResponse> {
    const { usuario, password } = credenciales;
    const correo = usuario?.trim();

    if (!correo || !password?.trim()) {
      return throwError(
        () =>
          ({
            ok: false,
            mensaje: 'Ingresa tu correo institucional y tu contraseña.',
          }) as AuthResponse,
      );
    }

    return this.http.post<boolean>(`${API_URL}/auth`, { email: correo, password }).pipe(
      map(() => {
        const respuesta: AuthResponse = {
          ok: true,
          mensaje: 'Autenticación exitosa',
          usuario: {
            nombre: correo.split('@')[0],
            correo,
            rol: 'administrador',
          },
        };
        this.guardarSesion(respuesta);
        return respuesta;
      }),
      catchError((err: HttpErrorResponse) => {
        const mensaje =
          err?.error?.message ??
          (err.status === 0
            ? 'No se pudo contactar al servidor. Verifica que el backend esté corriendo.'
            : 'Correo o contraseña incorrectos. Verifica tus credenciales.');

        return throwError(() => ({ ok: false, mensaje }) as AuthResponse);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(this.SESSION_KEY);
    this.usuarioActual.set(null);
  }

  /**
   * Nota: como el backend todavía no emite token, esto sólo revisa si hay
   * una sesión guardada localmente (no es seguridad real, es sólo para que
   * el guard de rutas de Angular sepa si mostrar el login o no). Cuando el
   * backend agregue JWT, esto debe cambiar a validar el token de verdad.
   */
  estaAutenticado(): boolean {
    return !!localStorage.getItem(this.SESSION_KEY);
  }

  private guardarSesion(res: AuthResponse): void {
    if (res.usuario) {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(res.usuario));
      this.usuarioActual.set(res.usuario);
    }
  }

  private recuperarUsuario(): AuthResponse['usuario'] | null {
    const raw = localStorage.getItem(this.SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
