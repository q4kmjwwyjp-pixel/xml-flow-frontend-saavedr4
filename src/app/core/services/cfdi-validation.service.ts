import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CfdiValidationResult, esFacturaAprobada } from '../models/cfdi-validation.model';

/**
 * CfdiValidationService
 * ----------------------
 * Punto único de navegación condicional entre la Pantalla de carga
 * (Interfaz 2, Persona 4) y las pantallas de Alerta de rechazo (Interfaz 3)
 * / Alerta de validación exitosa (Interfaz 4), responsabilidad de Persona 5.
 *
 * Cuando Persona 2 entregue el endpoint real (por ejemplo
 * POST /xml/validar, ver src/xml/xml.controller.ts en el repo de backend —
 * hoy solo tiene el CRUD scaffold de `nest g resource xml`), Persona 4 sólo
 * tiene que llamar a `procesarRespuesta(json)` con el body de la respuesta
 * HTTP y este servicio se encarga de:
 *   1) Guardar el resultado en un signal para que las pantallas de alerta
 *      lo consuman de forma reactiva.
 *   2) Redirigir automáticamente a /validacion-exitosa o /alerta-rechazo
 *      según el campo `estadoValidacion` del JSON (mismo nombre que la
 *      columna `estadoValidacion` del modelo FacturaXML en Prisma).
 *
 * Ejemplo de integración desde la Pantalla de carga (Persona 4):
 *
 *   this.http.post<CfdiValidationResult>('/api/xml/validar', formData)
 *     .subscribe((json) => this.cfdiValidationService.procesarRespuesta(json));
 */
@Injectable({ providedIn: 'root' })
export class CfdiValidationService {
  private readonly router = inject(Router);

  /** Último resultado de validación recibido de la API (consumido por las pantallas de alerta) */
  readonly resultadoActual = signal<CfdiValidationResult | null>(null);

  procesarRespuesta(json: CfdiValidationResult): void {
    this.resultadoActual.set(json);
    this.router.navigateByUrl(esFacturaAprobada(json) ? '/validacion-exitosa' : '/alerta-rechazo');
  }

  /** Utilidades para probar la navegación condicional sin depender del backend real (ver README) */
  simularRespuestaExitosa(): void {
    this.procesarRespuesta(MOCK_VALIDACION_EXITOSA);
  }

  simularRespuestaRechazada(): void {
    this.procesarRespuesta(MOCK_VALIDACION_RECHAZADA);
  }
}

/** Ejemplo de JSON aprobado, con la forma real del modelo FacturaXML + Proveedor (Interfaz 4) */
export const MOCK_VALIDACION_EXITOSA: CfdiValidationResult = {
  uuid: 'A1B2C3D4-E5F6-4A5B-9C8D-1234567890AB',
  serie: 'A',
  folio: '456',
  fechaEmision: '2026-08-28',
  subTotal: 41600.0,
  total: 48250.0,
  metodoPago: 'PPD',
  formaPago: '99',
  usoCfdi: 'G03',
  regimenReceptor: '624',
  condicionesPago: '30 días fecha factura',
  diasCredito: 30,
  estadoValidacion: 'Aprobada',
  motivoRechazo: null,
  proveedor: {
    rfc: 'PIN980215AB3',
    nombre: 'Proveedora Industrial del Norte S.A. de C.V.',
    regimenFiscal: '601',
  },
  fechaEstimadaPago: '2026-09-27',
  erroresDetalle: [],
};

/** Ejemplo de JSON rechazado, con la forma real del modelo FacturaXML + Proveedor (Interfaz 3) */
export const MOCK_VALIDACION_RECHAZADA: CfdiValidationResult = {
  uuid: 'B7C8D9E0-F1A2-4B3C-8D9E-0987654321CD',
  serie: 'B',
  folio: '457',
  fechaEmision: '2026-08-30',
  subTotal: 13683.19,
  total: 15870.5,
  metodoPago: 'PUE',
  formaPago: '03',
  usoCfdi: 'G01',
  regimenReceptor: '601',
  condicionesPago: '15 días',
  diasCredito: 15,
  estadoValidacion: 'Rechazada',
  motivoRechazo: 'El RFC receptor no coincide con el RFC registrado de la empresa (TSH7311116TL4).',
  proveedor: {
    rfc: 'SMB051022QK7',
    nombre: 'Suministros y Materiales del Bajío S.A. de C.V.',
    regimenFiscal: '601',
  },
  erroresDetalle: [
    {
      campo: 'RFC Receptor',
      descripcion: 'El RFC receptor no coincide con el registrado para la empresa.',
      valorEncontrado: 'TSH7311116TL5',
      valorEsperado: 'TSH7311116TL4',
    },
    {
      campo: 'Régimen Fiscal',
      descripcion: 'El régimen fiscal declarado no corresponde al régimen autorizado (624).',
      valorEncontrado: '601',
      valorEsperado: '624',
    },
    {
      campo: 'Uso de CFDI',
      descripcion: 'El uso de CFDI no corresponde a Adquisición de mercancías de uso general.',
      valorEncontrado: 'G01',
      valorEsperado: 'G03',
    },
  ],
};
