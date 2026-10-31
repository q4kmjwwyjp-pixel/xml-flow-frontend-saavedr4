import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CfdiValidationService } from '../../../core/services/cfdi-validation.service';
import { FacturaService } from '../../../core/services/factura.service';
import { LogoXmlFlowComponent } from '../../../shared/components/logo-xml-flow/logo-xml-flow.component';

@Component({
  selector: 'app-alerta-exito',
  standalone: true,
  imports: [CommonModule, FormsModule, LogoXmlFlowComponent],
  templateUrl: './alerta-exito.component.html',
  styleUrl: './alerta-exito.component.scss',
})
export class AlertaExitoComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly cfdiService = inject(CfdiValidationService);
  private readonly facturaService = inject(FacturaService);

  readonly resultado = this.cfdiService.resultadoActual;

  folioContrarreciboInput = signal<string>('');
  fechaPagoInput = signal<string>('');
  guardandoFecha = signal<boolean>(false);
  mensajeGuardado = signal<string | null>(null);
  errorGuardado = signal<string | null>(null);
  cambiosSinGuardar = signal<boolean>(false);

  ngOnInit(): void {
    const r = this.resultado();
    if (r) {
      const fechaInicial = r.fechaEstimadaPago
        ? String(r.fechaEstimadaPago).split('T')[0]
        : '';
      this.fechaPagoInput.set(fechaInicial);
      this.folioContrarreciboInput.set((r as any).folioContrarrecibo || '');
    }
  }

  esProveedorSinRegistro(): boolean {
    const r = this.resultado();
    const cod = (r?.proveedor?.codigoProveedor || '').trim();
    return !cod || cod === 'S/N' || cod.startsWith('PRV-');
  }

  /** Días de crédito fijos por proveedor (30 días si está registrado y es PPD; 0 si no está registrado o es PUE) */
  diasFijosProveedor(): number {
    const r = this.resultado();
    if (!r || r.metodoPago !== 'PPD') return 0;
    if (this.esProveedorSinRegistro()) return 0;
    return r.diasCredito && r.diasCredito > 0 ? r.diasCredito : 30;
  }

  /** Verifica si el archivo XML omite los días de crédito en el nodo <cfdi:Comprobante CondicionesDePago="..."> */
  faltaDiasCreditoEnXml(): boolean {
    const r = this.resultado();
    if (!r) return false;
    const cond = (r.condicionesPago || '').trim();
    if (!cond) return true;
    return !/\b(\d+)\s*d[ií]as?\b/i.test(cond);
  }

  onFolioContrarreciboChange(valor: string): void {
    this.folioContrarreciboInput.set(valor);
    this.mensajeGuardado.set(null);
    this.errorGuardado.set(null);
    this.cambiosSinGuardar.set(true);
  }

  onFechaManualChange(nuevaFecha: string): void {
    this.fechaPagoInput.set(nuevaFecha);
    this.mensajeGuardado.set(null);
    this.errorGuardado.set(null);
    this.cambiosSinGuardar.set(true);
  }

  guardarProgramacionPago(navegarDespuesA?: string): void {
    const r = this.resultado();
    if (!r || !r.uuid || r.uuid === 'N/A') {
      if (navegarDespuesA) this.router.navigateByUrl(navegarDespuesA);
      return;
    }

    this.guardandoFecha.set(true);
    this.mensajeGuardado.set(null);
    this.errorGuardado.set(null);

    const fecha = (this.fechaPagoInput() || '').trim() || null;
    const diasFijos = this.diasFijosProveedor();
    const folioCR = (this.folioContrarreciboInput() || '').trim() || null;

    const payload: {
      fechaEstimadaPago: string | null;
      diasCredito?: number | null;
      folioContrarrecibo?: string | null;
    } = {
      fechaEstimadaPago: fecha,
      diasCredito: diasFijos,
    };
    if (folioCR !== null) {
      payload.folioContrarrecibo = folioCR;
    }

    this.facturaService.actualizarProgramacionPago(r.uuid, payload).subscribe({
      next: () => {
        this.guardandoFecha.set(false);
        this.cambiosSinGuardar.set(false);
        this.cfdiService.resultadoActual.set({
          ...r,
          fechaEstimadaPago: fecha,
          diasCredito: diasFijos,
        });
        this.mensajeGuardado.set('✅ Fecha de pago guardada correctamente.');
        if (navegarDespuesA) {
          this.router.navigateByUrl(navegarDespuesA);
        }
      },
      error: () => {
        this.guardandoFecha.set(false);
        this.errorGuardado.set(
          'No se pudo actualizar la fecha en el servidor. Intenta de nuevo.'
        );
        if (navegarDespuesA) {
          this.router.navigateByUrl(navegarDespuesA);
        }
      },
    });
  }

  irADashboard(): void {
    if (this.cambiosSinGuardar()) {
      this.guardarProgramacionPago('/dashboard');
      return;
    }
    this.router.navigateByUrl('/dashboard');
  }

  cargarOtroXml(): void {
    if (this.cambiosSinGuardar()) {
      this.guardarProgramacionPago('/carga');
      return;
    }
    this.router.navigateByUrl('/carga');
  }
}
