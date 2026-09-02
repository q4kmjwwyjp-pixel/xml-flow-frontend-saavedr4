import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CfdiValidationService } from '../../core/services/cfdi-validation.service';
import { LogoXmlFlowComponent } from '../../shared/components/logo-xml-flow/logo-xml-flow.component';

/**
 * Placeholder TEMPORAL de la Interfaz 1 (Dashboard de operaciones).
 * Esa pantalla es responsabilidad de Persona 3 — cuando la entregue,
 * reemplaza esta ruta en app.routes.ts por su componente real y borra este
 * archivo.
 *
 * Mientras tanto sirve para: (a) confirmar que el login redirige bien tras
 * autenticarse, y (b) probar la navegación condicional de las Interfaces 3
 * y 4 sin depender de que la Pantalla de carga (Persona 4) ya esté lista.
 */
@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule, LogoXmlFlowComponent],
  template: `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem;font-family:'Segoe UI',system-ui,sans-serif;background:#f5f8ff;">
      <app-logo-xml-flow [size]="48"></app-logo-xml-flow>
      <h1 style="color:#0f2247;margin:0;">Dashboard de operaciones (placeholder)</h1>
      <p style="color:#6b7280;max-width:420px;text-align:center;margin:0;">
        Aquí va la Interfaz 1 real de Persona 3. Mientras tanto, usa estos botones para
        probar la navegación condicional de las Interfaces 3 y 4.
      </p>
      <div style="display:flex;gap:0.75rem;">
        <button (click)="probarExito()" style="background:#16a34a;color:#fff;border:none;border-radius:10px;padding:0.75rem 1.25rem;font-weight:600;cursor:pointer;">
          Simular CFDI válido
        </button>
        <button (click)="probarRechazo()" style="background:#dc2626;color:#fff;border:none;border-radius:10px;padding:0.75rem 1.25rem;font-weight:600;cursor:pointer;">
          Simular CFDI rechazado
        </button>
      </div>
      <button (click)="cerrarSesion()" style="background:none;border:1.5px solid #e5e7eb;border-radius:10px;padding:0.6rem 1.1rem;color:#16336b;font-weight:600;cursor:pointer;">
        Cerrar sesión
      </button>
    </div>
  `,
})
export class DashboardPlaceholderComponent {
  private readonly cfdiService = inject(CfdiValidationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  probarExito(): void {
    this.cfdiService.simularRespuestaExitosa();
  }

  probarRechazo(): void {
    this.cfdiService.simularRespuestaRechazada();
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
