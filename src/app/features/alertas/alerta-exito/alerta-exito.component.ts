import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CfdiValidationService } from '../../../core/services/cfdi-validation.service';
import { LogoXmlFlowComponent } from '../../../shared/components/logo-xml-flow/logo-xml-flow.component';

/**
 * Interfaz 4 — Alerta de validación exitosa
 * -------------------------------------------
 * Pantalla de resumen que confirma que el CFDI pasó los filtros fiscales.
 * Consume el resultado guardado por CfdiValidationService, que es el que
 * decide la navegación condicional (ver ese servicio para el ejemplo de
 * integración con el endpoint real de NestJS).
 */
@Component({
  selector: 'app-alerta-exito',
  standalone: true,
  imports: [CommonModule, LogoXmlFlowComponent],
  templateUrl: './alerta-exito.component.html',
  styleUrl: './alerta-exito.component.scss',
})
export class AlertaExitoComponent {
  private readonly router = inject(Router);
  private readonly cfdiService = inject(CfdiValidationService);

  readonly resultado = this.cfdiService.resultadoActual;

  irADashboard(): void {
    this.router.navigateByUrl('/dashboard');
  }

  cargarOtroXml(): void {
    this.router.navigateByUrl('/carga');
  }
}
