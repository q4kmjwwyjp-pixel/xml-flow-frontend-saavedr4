import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { AlertaExitoComponent } from './features/alertas/alerta-exito/alerta-exito.component';
import { AlertaRechazoComponent } from './features/alertas/alerta-rechazo/alerta-rechazo.component';
import { Dashboard } from './features/dashboard/dashboard';
import { UploadPage } from './features/upload-page/upload-page';
import { PagosProgramados } from './features/pagos-programados/pagos-programados';

export const routes: Routes = [
  {
    path: 'pagos-programados', component: PagosProgramados
  },
  {
    path: "",
    component: LoginComponent
  },
  {
    path: "rechazo",
    component: AlertaRechazoComponent
  },
  {
    path: 'alerta-rechazo',
    component: AlertaRechazoComponent,
  },
  {
    path: 'validacion-exitosa',
    component: AlertaExitoComponent
  },
  {
    path: 'exito',
    redirectTo: 'validacion-exitosa',
    pathMatch: 'full',
  },
  {
    path: 'rechazo',
    redirectTo: 'alerta-rechazo',
    pathMatch: 'full',
  },
  {
    path: "upload",
    component: UploadPage
  },
  {
    path: "carga",
    component: UploadPage
  },
  {
    path: "dashboard",
    component: Dashboard
  }
];