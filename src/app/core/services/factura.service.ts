import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { FacturaResumen } from '../models/factura.model';
import {
  obtenerDatosCatalogoPorRfc,
  resolverCodigoProveedor,
} from '../utils/catalogo-proveedores';

@Injectable({
  providedIn: 'root',
})
export class FacturaService {
  private http = inject(HttpClient);
  private apiUrl = 'https://xml-flow-back-end.onrender.com';

  // 1. Obtener todas las facturas desde /xml
  getFacturas(): Observable<FacturaResumen[]> {
    return this.http.get<any>(`${this.apiUrl}/xml`).pipe(
      map((respuestaBackend) => {
        const arregloFacturas = Array.isArray(respuestaBackend)
          ? respuestaBackend
          : respuestaBackend.data || respuestaBackend.facturas || [];

        return arregloFacturas.map((f: any) => this.mapearFacturaFront(f));
      })
    );
  }

  // 2. Obtener una factura por UUID desde /xml/:uuid
  getFacturaPorUuid(uuid: string): Observable<FacturaResumen> {
    return this.http
      .get<any>(`${this.apiUrl}/xml/${encodeURIComponent(uuid)}`)
      .pipe(map((f) => this.mapearFacturaFront(f)));
  }

  // 2.1 Obtener reporte semanal y concentrado contable desde /xml/reporte/semanal
  getReporteSemanal(params?: {
    fechaInicio?: string;
    fechaFin?: string;
    criterio?: 'pago' | 'emision' | 'recepcion';
    estado?: string;
    metodoPago?: string;
  }): Observable<{
    resumen: any;
    concentradoProveedores: any[];
    facturas: FacturaResumen[];
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.fechaInicio) queryParams['fechaInicio'] = params.fechaInicio;
    if (params?.fechaFin) queryParams['fechaFin'] = params.fechaFin;
    if (params?.criterio) queryParams['criterio'] = params.criterio;
    if (params?.estado) queryParams['estado'] = params.estado;
    if (params?.metodoPago) queryParams['metodoPago'] = params.metodoPago;

    return this.http
      .get<any>(`${this.apiUrl}/xml/reporte/semanal`, { params: queryParams })
      .pipe(
        map((resp) => ({
          resumen: resp?.resumen || null,
          concentradoProveedores: Array.isArray(resp?.concentradoProveedores)
            ? resp.concentradoProveedores.map((p: any) => ({
                ...p,
                codigoProveedor: resolverCodigoProveedor(
                  p.rfc,
                  p.codigoProveedor
                ),
              }))
            : [],
          facturas: Array.isArray(resp?.facturas)
            ? resp.facturas.map((f: any) => this.mapearFacturaFront(f))
            : [],
        }))
      );
  }

  // --- NUEVOS MÉTODOS PARA ACTUALIZAR ESTADO EN EL BACKEND ---
  marcarComoPagado(uuid: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/xml/${encodeURIComponent(uuid)}/pagado`,
      {}
    );
  }

  marcarComoVencido(uuid: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/xml/${encodeURIComponent(uuid)}/vencido`,
      {}
    );
  }

  // 3. Función de mapeo
  private mapearFacturaFront(f: any): FacturaResumen {
    const rfcEmisor = f.proveedor?.rfc || 'Sin RFC';
    const datosCatalogo = obtenerDatosCatalogoPorRfc(rfcEmisor);
    const claveReal = resolverCodigoProveedor(
      rfcEmisor,
      f.proveedor?.codigoProveedor
    );
    const codigoFinal =
      claveReal !== 'S/N' ? claveReal : `PRV-${f.proveedor?.id || '000'}`;

    return {
      uuid: f.uuid,
      folio: f.serie ? `${f.serie}-${f.folio}` : f.folio || f.uuid,
      codigoProveedor: codigoFinal,
      nombreProveedor:
        f.proveedor?.nombre ||
        datosCatalogo?.nombre ||
        'Proveedor Desconocido',
      rfcEmisor,
      metodoPago: f.metodoPago,
      formaPago: f.formaPago,
      diasCredito: f.diasCredito || 0,
      fechaProgramacionPago: f.fechaEstimadaPago
        ? f.fechaEstimadaPago.split('T')[0]
        : '',
      fechaRevision: f.createdAt ? f.createdAt.split('T')[0] : '',
      total: Number(f.total),
      estado: f.estado || 'Pendiente',
      motivoRechazo: f.motivoRechazo,
      fechaEmision: f.fechaEmision ? f.fechaEmision.split('T')[0] : '',
      subTotal: f.subTotal != null ? Number(f.subTotal) : undefined,
      usoCfdi: f.usoCfdi,
      regimenReceptor: f.regimenReceptor,
      regimenEmisor:
        f.proveedor?.regimenFiscal || datosCatalogo?.regimenFiscal,
      condicionesPago: f.condicionesPago ?? undefined,
      checksFiscales: {
        regimenValido: f.regimenReceptor === '624',
        usoCfdiValido: f.usoCfdi === 'G03',
        metodoPagoValido: f.metodoPago === 'PPD' || f.metodoPago === 'PUE',
        formaPagoValida: f.formaPago === '99' || f.formaPago === '03',
      },
    };
  }
}
