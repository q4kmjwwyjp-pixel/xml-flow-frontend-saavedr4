import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { AlertaExitoComponent } from './features/alertas/alerta-exito/alerta-exito.component';
import { AlertaRechazoComponent } from './features/alertas/alerta-rechazo/alerta-rechazo.component';
import { Dashboard } from './features/dashboard/dashboard';
import { UploadPage } from './features/upload-page/upload-page';
import { PagosProgramados } from './features/pagos-programados/pagos-programados';
import { DetalleFactura } from './features/detalle-factura/detalle-factura';
import { ReportesSemanales } from './features/reportes-semanales/reportes-semanales';
import { Proveedores } from './features/proveedores/proveedores.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'reportes-semanales',
    component: ReportesSemanales,
    canActivate: [authGuard],
  },
  {
    path: 'pagos-programados',
    component: PagosProgramados,
    canActivate: [authGuard],
  },
  {
    path: 'pagos-programados/:uuid',
    component: DetalleFactura,
    canActivate: [authGuard],
  },
  {
    path: '',
    component: LoginComponent,
  },
  {
    path: 'rechazo',
    component: AlertaRechazoComponent,
    canActivate: [authGuard],
  },
  {
    path: 'alerta-rechazo',
    component: AlertaRechazoComponent,
    canActivate: [authGuard],
  },
  {
    path: 'validacion-exitosa',
    component: AlertaExitoComponent,
    canActivate: [authGuard],
  },
  {
    path: 'exito',
    redirectTo: 'validacion-exitosa',
    pathMatch: 'full',
  },
  {
    path: 'upload',
    component: UploadPage,
    canActivate: [authGuard],
  },
  {
    path: 'carga',
    component: UploadPage,
    canActivate: [authGuard],
  },
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard],
  },
  {
    path: 'proveedores',
    component: Proveedores,
    canActivate: [authGuard],
  },
];
