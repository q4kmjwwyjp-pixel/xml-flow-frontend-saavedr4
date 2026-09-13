import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { AlertaExitoComponent } from './features/alertas/alerta-exito/alerta-exito.component';
import { AlertaRechazoComponent } from './features/alertas/alerta-rechazo/alerta-rechazo.component';
import { UploadPage } from './features/upload-page/upload-page';
import { Dashboard } from './features/dashboard/dashboard';

export const routes: Routes = [
  {
    path: "",
    component: LoginComponent
  },
  {
    path: 'validacion-exitosa',
    component: AlertaExitoComponent,
  },
  {
    path: 'alerta-rechazo',
    component: AlertaRechazoComponent,
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
