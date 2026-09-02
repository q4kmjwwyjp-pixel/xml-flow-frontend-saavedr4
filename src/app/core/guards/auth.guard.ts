import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard funcional que protege las rutas internas (dashboard, alertas,
 * tablero de pagos, etc.). Si no hay sesión simulada activa, redirige a
 * /login en lugar de dejar pasar al usuario.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado()) {
    return true;
  }

  router.navigateByUrl('/login');
  return false;
};
