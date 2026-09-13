import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { FacturaResumen } from '../models/factura.model';

@Injectable({
  providedIn: 'root'
})
export class FacturaService {
  private http = inject(HttpClient);
  private apiUrl = 'https://xml-flow-back-end.onrender.com'; // Cambiar a la URL de Render

  // 1. Obtener todas las facturas desde /xml
  getFacturas(): Observable<FacturaResumen[]> {
    return this.http.get<any>(`${this.apiUrl}/xml`).pipe(
      map(respuestaBackend => {
        console.log('1. Respuesta cruda de Render:', respuestaBackend);

        const arregloFacturas = Array.isArray(respuestaBackend) 
          ? respuestaBackend 
          : (respuestaBackend.data || respuestaBackend.facturas || []);

        // ESTE RETURN ES VITAL, si falta, el componente recibe 'undefined'
        return arregloFacturas.map((f: any) => this.mapearFacturaFront(f));
      })
    );
  }

  // 2. Función de mapeo (igual a la anterior)
  private mapearFacturaFront(f: any): FacturaResumen {
    return {
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
      estado: (f.estadoValidacion === 'Validada' || f.estadoValidacion === 'Aprobada') 
               ? (f.metodoPago === 'PUE' ? 'PAGADA' : 'PROGRAMADA') 
               : 'RECHAZADA',
      motivoRechazo: f.motivoRechazo,
      checksFiscales: {
        regimenValido: f.regimenReceptor === '624',
        usoCfdiValido: f.usoCfdi === 'G03',
        metodoPagoValido: f.metodoPago === 'PPD' || f.metodoPago === 'PUE',
        formaPagoValida: f.formaPago === '99' || f.formaPago === '03'
      }
    };
  }
}