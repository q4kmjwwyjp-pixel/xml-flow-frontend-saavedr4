import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { FacturaResumen, MetricasDashboard } from '../models/factura.model';

@Injectable({
  providedIn: 'root'
})
export class FacturaService {
  private facturasMock: FacturaResumen[] = [
    {
      id: '1',
      folio: 'XML-2026-001',
      codigoProveedor: 'PRV-101',
      nombreProveedor: 'Llantas y Refacciones del Norte S.A. de C.V.',
      rfcEmisor: 'LRN010203AB1',
      condicion: 'Crédito',
      total: 45200.00,
      fechaRevision: '2026-08-13',
      diasCredito: 30,
      fechaProgramacionPago: '2026-09-12',
      metodoPago: 'PPD',
      formaPago: '99',
      estado: 'PROGRAMADA',
      checksFiscales: {
        proveedorEnBD: true,
        razonSocialValida: true,
        rfcValido: true,
        rfcReceptorValido: true,
        regimenValido: true,
        usoCfdiValido: true,
        metodoTransferencia: true,
        metodoPagoValido: true,
        formaPagoValida: true
      }
    },
    {
      id: '2',
      folio: 'XML-2026-002',
      codigoProveedor: 'PRV-102',
      nombreProveedor: 'Cementos y Concretos de Apodaca S.A.',
      rfcEmisor: 'CCA950510XYZ',
      condicion: 'Crédito',
      total: 18350.50,
      fechaRevision: '2026-08-15',
      diasCredito: 45,
      fechaProgramacionPago: '2026-09-29',
      metodoPago: 'PPD',
      formaPago: '99',
      estado: 'PROGRAMADA',
      checksFiscales: {
        proveedorEnBD: true,
        razonSocialValida: true,
        rfcValido: true,
        rfcReceptorValido: true,
        regimenValido: true,
        usoCfdiValido: true,
        metodoTransferencia: true,
        metodoPagoValido: true,
        formaPagoValida: true
      }
    },
    {
      id: '3',
      folio: 'XML-2026-003',
      codigoProveedor: 'PRV-103',
      nombreProveedor: 'Logística y Fletes Regiomontana S.A.',
      rfcEmisor: 'LFR041212AA1',
      condicion: 'Crédito',
      total: 8900.00,
      fechaRevision: '2026-07-14',
      diasCredito: 60,
      fechaProgramacionPago: '2026-09-12',
      metodoPago: 'PPD',
      formaPago: '99',
      estado: 'RECHAZADA',
      motivoRechazo: 'Uso de CFDI incorrecto: Se especificó CP01 en lugar de G03 (Gastos en general).',
      checksFiscales: {
        proveedorEnBD: true,
        razonSocialValida: true,
        rfcValido: true,
        rfcReceptorValido: true,
        regimenValido: true,
        usoCfdiValido: false,
        metodoTransferencia: true,
        metodoPagoValido: true,
        formaPagoValida: true
      }
    },
    {
      id: '4',
      folio: 'XML-2026-004',
      codigoProveedor: 'PRV-104',
      nombreProveedor: 'Combustibles e Hidrocarburos del Bravo',
      rfcEmisor: 'CHB120315KL9',
      condicion: 'Crédito',
      total: 62400.00,
      fechaRevision: '2026-06-30',
      diasCredito: 90,
      fechaProgramacionPago: '2026-09-28',
      metodoPago: 'PPD',
      formaPago: '99',
      estado: 'PROGRAMADA',
      checksFiscales: {
        proveedorEnBD: true,
        razonSocialValida: true,
        rfcValido: true,
        rfcReceptorValido: true,
        regimenValido: true,
        usoCfdiValido: true,
        metodoTransferencia: true,
        metodoPagoValido: true,
        formaPagoValida: true
      }
    },
    {
      id: '5',
      folio: 'XML-2026-005',
      codigoProveedor: 'PRV-105',
      nombreProveedor: 'Taller Mecánico y Mantenimiento Diesel',
      rfcEmisor: 'TMM990815JJ2',
      condicion: 'Contado',
      total: 12700.00,
      fechaRevision: '2026-09-11',
      diasCredito: 0,
      fechaProgramacionPago: '2026-09-11',
      metodoPago: 'PUE',
      formaPago: '03',
      estado: 'RECHAZADA',
      motivoRechazo: 'Régimen fiscal del receptor incorrecto: Viene 601 en vez de 624 (Coordinados).',
      checksFiscales: {
        proveedorEnBD: true,
        razonSocialValida: true,
        rfcValido: true,
        rfcReceptorValido: true,
        regimenValido: false,
        usoCfdiValido: true,
        metodoTransferencia: true,
        metodoPagoValido: true,
        formaPagoValida: true
      }
    },
    {
      id: '6',
      folio: 'B1-486596412T1',
      codigoProveedor: 'PRV-106',
      nombreProveedor: 'TOTAL PLAY TELECOMUNICACIONES',
      rfcEmisor: 'TPT890516JP5',
      condicion: 'Crédito',
      total: 11618.23,
      fechaRevision: '2026-09-09',
      diasCredito: 18,
      fechaProgramacionPago: '2026-09-27',
      metodoPago: 'PPD',
      formaPago: '99',
      estado: 'RECHAZADA',
      motivoRechazo: 'Régimen fiscal del receptor en XML es 601 (General de Ley) y no coincide con el de la empresa (624 - Coordinados).',
      checksFiscales: {
        proveedorEnBD: true,
        razonSocialValida: true,
        rfcValido: true,
        rfcReceptorValido: true,
        regimenValido: false,
        usoCfdiValido: true,
        metodoTransferencia: true,
        metodoPagoValido: true,
        formaPagoValida: true
      }
    }
  ];

  getMetricas(): Observable<MetricasDashboard> {
    const hoy = '2026-09-12';
    const metricas: MetricasDashboard = {
      totalRevisadas: this.facturasMock.length,
      totalProgramadas: this.facturasMock.filter(f => f.estado === 'PROGRAMADA').length,
      totalRechazadas: this.facturasMock.filter(f => f.estado === 'RECHAZADA').length,
      pagosProgramadosHoy: this.facturasMock.filter(f => f.estado === 'PROGRAMADA' && f.fechaProgramacionPago === hoy).length,
      montoProgramadoPago: this.facturasMock
        .filter(f => f.estado === 'PROGRAMADA')
        .reduce((acc, f) => acc + f.total, 0)
    };
    return of(metricas);
  }

  getFacturas(): Observable<FacturaResumen[]> {
    return of(this.facturasMock);
  }
}