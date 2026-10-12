import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { FacturaResumen } from '../models/factura.model';

@Injectable({
  providedIn: 'root'
})
export class FacturaService {
  private http = inject(HttpClient);
  private apiUrl = 'https://xml-flow-back-end.onrender.com';

  // 1. Obtener todas las facturas desde /xml
  getFacturas(): Observable<FacturaResumen[]> {
    return this.http.get<any>(`${this.apiUrl}/xml`).pipe(
      map(respuestaBackend => {
        const arregloFacturas = Array.isArray(respuestaBackend) 
          ? respuestaBackend 
          : (respuestaBackend.data || respuestaBackend.facturas || []);

        return arregloFacturas.map((f: any) => this.mapearFacturaFront(f));
      })
    );
  }

  // 2. Obtener una factura por UUID desde /xml/:uuid
  getFacturaPorUuid(uuid: string): Observable<FacturaResumen> {
    return this.http
      .get<any>(`${this.apiUrl}/xml/${encodeURIComponent(uuid)}`)
      .pipe(map(f => this.mapearFacturaFront(f)));
  }

  // --- NUEVOS MÉTODOS PARA ACTUALIZAR ESTADO EN EL BACKEND ---
  marcarComoPagado(uuid: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/xml/${encodeURIComponent(uuid)}/pagado`, {});
  }

  marcarComoVencido(uuid: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/xml/${encodeURIComponent(uuid)}/vencido`, {});
  }

  // 3. Función de mapeo
  private mapearFacturaFront(f: any): FacturaResumen {
    return {
      uuid: f.uuid,
      folio: f.serie ? `${f.serie}-${f.folio}` : (f.folio || f.uuid),
      codigoProveedor: `PRV-${f.proveedor?.id || '000'}`, 
      nombreProveedor: f.proveedor?.nombre || 'Proveedor Desconocido',
      rfcEmisor: f.proveedor?.rfc || 'Sin RFC',
      metodoPago: f.metodoPago,
      formaPago: f.formaPago,
      diasCredito: f.diasCredito || 0,
      fechaProgramacionPago: f.fechaEstimadaPago ? f.fechaEstimadaPago.split('T')[0] : '',
      fechaRevision: f.createdAt ? f.createdAt.split('T')[0] : '',
      total: Number(f.total),
      
      // AQUÍ ESTÁ LA SOLUCIÓN:
      // Ya no calculamos el estado. Simplemente tomamos el que viene del backend.
      // Si por alguna razón viene vacío (en facturas viejas), le ponemos 'Pendiente' por defecto.
      estado: f.estado || 'Pendiente',
      
      motivoRechazo: f.motivoRechazo,
      fechaEmision: f.fechaEmision ? f.fechaEmision.split('T')[0] : '',
      subTotal: f.subTotal != null ? Number(f.subTotal) : undefined,
      usoCfdi: f.usoCfdi,
      regimenReceptor: f.regimenReceptor,
      regimenEmisor: f.proveedor?.regimenFiscal,
      condicionesPago: f.condicionesPago ?? undefined,
      checksFiscales: {
        regimenValido: f.regimenReceptor === '624',
        usoCfdiValido: f.usoCfdi === 'G03',
        metodoPagoValido: f.metodoPago === 'PPD' || f.metodoPago === 'PUE',
        formaPagoValida: f.formaPago === '99' || f.formaPago === '03'
      }
    };
  }
}