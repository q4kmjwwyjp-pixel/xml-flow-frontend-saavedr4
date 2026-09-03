import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { AlertaExitoComponent } from './features/alertas/alerta-exito/alerta-exito.component';
import { AlertaRechazoComponent } from './features/alertas/alerta-rechazo/alerta-rechazo.component';

export const routes: Routes = [
  {
    path: "",
    component: LoginComponent
  },
  {
    path: "rechazo",
    component: AlertaRechazoComponent
  },
  {
    path: "exito",
    component: AlertaExitoComponent
  }
];
