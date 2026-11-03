import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CfdiValidationService } from '../../../core/services/cfdi-validation.service';
import { FacturaService } from '../../../core/services/factura.service';
import { obtenerDatosCatalogoPorRfc } from '../../../core/utils/catalogo-proveedores';
import {
  calcularDiasCredito,
  diasCreditoDesdeXml,
  diasCreditoEnListaProveedores,
} from '../../../core/utils/dias-credito';
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
    const delCat = obtenerDatosCatalogoPorRfc(r?.proveedor?.rfc);
    return (!cod || cod === 'S/N' || cod.startsWith('PRV-')) && !delCat;
  }

  /** Días de crédito especificados directamente dentro del XML (atributo CondicionesDePago) */
  diasEnXml(): number | null {
    return diasCreditoDesdeXml(this.resultado()?.condicionesPago);
  }

  /** Días de crédito en la Lista de Proveedores (columna "Cond. Pag./Prov.") */
  diasEnListaProveedores(): number | null {
    const r = this.resultado();
    if (!r || this.esProveedorSinRegistro()) return null;
    return diasCreditoEnListaProveedores(r.proveedor?.rfc, r.diasCredito);
  }

  /** Plazo final validado (1° XML -> 2° Lista de Proveedores "Cond. Pag./Prov." -> 3° 0) */
  diasFijosProveedor(): number {
    const r = this.resultado();
    if (!r) return 0;
    return calcularDiasCredito({
      condicionesPago: r.condicionesPago,
      metodoPago: r.metodoPago,
      rfc: r.proveedor?.rfc,
      diasCredito: r.diasCredito,
    }).dias;
  }

  /** Caso crítico: No viene en el XML y tampoco está registrado en la lista de proveedores */
  sinDiasEnXmlNiEnListaProveedores(): boolean {
    return this.diasEnXml() === null && this.diasEnListaProveedores() === null;
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
