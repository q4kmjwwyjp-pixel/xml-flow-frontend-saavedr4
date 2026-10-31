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

  fechaPagoInput = signal<string>('');
  diasCreditoInput = signal<number | null>(null);
  baseCalculo = signal<'revision' | 'emision'>('revision');
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
      this.diasCreditoInput.set(
        r.diasCredito && r.diasCredito > 0 ? r.diasCredito : null
      );
    }
  }

  esProveedorSinRegistro(): boolean {
    const r = this.resultado();
    const cod = (r?.proveedor?.codigoProveedor || '').trim();
    return !cod || cod === 'S/N' || cod.startsWith('PRV-');
  }

  onFechaManualChange(nuevaFecha: string): void {
    this.fechaPagoInput.set(nuevaFecha);
    this.mensajeGuardado.set(null);
    this.errorGuardado.set(null);
    this.cambiosSinGuardar.set(true);

    if (nuevaFecha) {
      const base = this.obtenerFechaBase();
      const destino = new Date(`${nuevaFecha}T12:00:00`);
      const diffMs = destino.getTime() - base.getTime();
      const diffDias = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      this.diasCreditoInput.set(diffDias);
    }
  }

  onDiasCreditoChange(valor: number | string | null): void {
    const dias =
      valor !== null && valor !== '' && !Number.isNaN(Number(valor))
        ? Math.max(0, Math.round(Number(valor)))
        : null;
    this.diasCreditoInput.set(dias);
    this.mensajeGuardado.set(null);
    this.errorGuardado.set(null);
    this.cambiosSinGuardar.set(true);

    if (dias !== null) {
      const base = this.obtenerFechaBase();
      base.setDate(base.getDate() + dias);
      this.fechaPagoInput.set(this.formatearFechaISO(base));
    }
  }

  cambiarBaseCalculo(nuevaBase: 'revision' | 'emision'): void {
    this.baseCalculo.set(nuevaBase);
    const dias = this.diasCreditoInput();
    if (dias !== null) {
      this.onDiasCreditoChange(dias);
    }
  }

  aplicarPlazoRapido(dias: number): void {
    this.onDiasCreditoChange(dias);
  }

  private obtenerFechaBase(): Date {
    const r = this.resultado();
    if (this.baseCalculo() === 'emision' && r?.fechaEmision) {
      const f = String(r.fechaEmision).split('T')[0];
      const parsed = new Date(`${f}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    return hoy;
  }

  private formatearFechaISO(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
    const dias = this.diasCreditoInput();

    this.facturaService
      .actualizarProgramacionPago(r.uuid, {
        fechaEstimadaPago: fecha,
        diasCredito: dias,
      })
      .subscribe({
        next: () => {
          this.guardandoFecha.set(false);
          this.cambiosSinGuardar.set(false);
          this.cfdiService.resultadoActual.set({
            ...r,
            fechaEstimadaPago: fecha,
            diasCredito: dias ?? 0,
          });
          this.mensajeGuardado.set(
            fecha
              ? `✅ Fecha estimada de pago actualizada al ${fecha}.`
              : '✅ Fecha estimada de pago actualizada.'
          );
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
