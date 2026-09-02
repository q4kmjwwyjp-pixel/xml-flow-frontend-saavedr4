import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },

  // Interfaz 1 — Dashboard de operaciones. Placeholder temporal, ver el
  // comentario dentro del componente para reemplazarlo por el real de
  // Persona 3.
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard-placeholder/dashboard-placeholder.component').then(
        (m) => m.DashboardPlaceholderComponent,
      ),
  },

  // Interfaz 4 — Alerta de validación exitosa (Persona 5)
  {
    path: 'validacion-exitosa',
    loadComponent: () =>
      import('./features/alertas/alerta-exito/alerta-exito.component').then((m) => m.AlertaExitoComponent),
  },

  // Interfaz 3 — Alerta de rechazo (Persona 5)
  {
    path: 'alerta-rechazo',
    loadComponent: () =>
      import('./features/alertas/alerta-rechazo/alerta-rechazo.component').then((m) => m.AlertaRechazoComponent),
  },

  { path: '**', redirectTo: 'login' },
];
