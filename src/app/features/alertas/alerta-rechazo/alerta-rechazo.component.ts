import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CfdiValidationService } from '../../../core/services/cfdi-validation.service';
import { LogoXmlFlowComponent } from '../../../shared/components/logo-xml-flow/logo-xml-flow.component';

/**
 * Interfaz 3 — Alerta de rechazo
 * --------------------------------
 * Vista de diagnóstico fiscal detallado cuando el motor de NestJS detecta
 * errores o discrepancias en el CFDI (RFC, régimen fiscal, uso de CFDI,
 * etc.). Consume el resultado guardado por CfdiValidationService.
 */
@Component({
  selector: 'app-alerta-rechazo',
  standalone: true,
  imports: [CommonModule, LogoXmlFlowComponent],
  templateUrl: './alerta-rechazo.component.html',
  styleUrl: './alerta-rechazo.component.scss',
})
export class AlertaRechazoComponent {
  private readonly router = inject(Router);
  private readonly cfdiService = inject(CfdiValidationService);

  readonly resultado = this.cfdiService.resultadoActual;

  reintentarCarga(): void {
    this.router.navigateByUrl('/carga');
  }

  irADashboard(): void {
    this.router.navigateByUrl('/dashboard');
  }
}
