import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { FacturaResumen } from '../models/factura.model';
import {
  obtenerDatosCatalogoPorRfc,
  resolverCodigoProveedor,
} from '../utils/catalogo-proveedores';
import { API_URL } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class FacturaService {
  private http = inject(HttpClient);
  private apiUrl = API_URL;

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
    moneda?: string;
    folioContrarrecibo?: string;
    soloConContrarrecibo?: boolean;
    ordenFolio?: 'asc' | 'desc';
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
    if (params?.moneda) queryParams['moneda'] = params.moneda;
    if (params?.folioContrarrecibo) {
      queryParams['folioContrarrecibo'] = params.folioContrarrecibo;
    }
    if (params?.soloConContrarrecibo !== undefined) {
      queryParams['soloConContrarrecibo'] = String(params.soloConContrarrecibo);
    }
    if (params?.ordenFolio) queryParams['ordenFolio'] = params.ordenFolio;

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

  // --- MÉTODOS PARA ACTUALIZAR ESTADO, FECHA DE PAGO Y CONTRARRECIBO EN EL BACKEND ---
  actualizarContrarrecibo(
    uuid: string,
    folioContrarrecibo: string | null,
    fechaEstimadaPago?: string | null,
    diasCredito?: number | null
  ): Observable<FacturaResumen> {
    const body: Record<string, any> = {
      folioContrarrecibo: folioContrarrecibo ? folioContrarrecibo.trim() : null,
    };
    if (fechaEstimadaPago !== undefined) {
      body['fechaEstimadaPago'] = fechaEstimadaPago;
    }
    if (diasCredito !== undefined) {
      body['diasCredito'] = diasCredito;
    }

    return this.http
      .patch<any>(
        `${this.apiUrl}/xml/${encodeURIComponent(uuid)}/contrarrecibo`,
        body
      )
      .pipe(map((f) => this.mapearFacturaFront(f)));
  }

  actualizarProgramacionPago(
    uuid: string,
    datos: {
      fechaEstimadaPago: string | null;
      diasCredito?: number | null;
      folioContrarrecibo?: string | null;
    }
  ): Observable<FacturaResumen> {
    return this.http
      .patch<any>(
        `${this.apiUrl}/xml/${encodeURIComponent(uuid)}/contrarrecibo`,
        datos
      )
      .pipe(map((f) => this.mapearFacturaFront(f)));
  }

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

  eliminarFactura(uuid: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/xml/delete`, {
      body: { uuid },
    });
  }

  // 3. Función de mapeo
  private mapearFacturaFront(f: any): FacturaResumen {
    const rfcEmisor = f.proveedor?.rfc || 'Sin RFC';
    const datosCatalogo = obtenerDatosCatalogoPorRfc(rfcEmisor);
    const claveReal = resolverCodigoProveedor(
      rfcEmisor,
      f.proveedor?.codigoProveedor
    );
    const estaRegistrado = claveReal !== 'S/N';
    const codigoFinal = estaRegistrado
      ? claveReal
      : `PRV-${f.proveedor?.id || '000'}`;

    const monedaNormalizada = String(f.moneda || 'MXN')
      .trim()
      .toUpperCase();

    const diasCreditoCalculados =
      f.metodoPago === 'PPD'
        ? estaRegistrado
          ? f.diasCredito && f.diasCredito > 0
            ? Number(f.diasCredito)
            : 30
          : 0
        : 0;

    return {
      uuid: f.uuid,
      folio: f.serie ? `${f.serie}-${f.folio}` : f.folio || f.uuid,
      folioContrarrecibo: f.folioContrarrecibo
        ? String(f.folioContrarrecibo).trim()
        : undefined,
      moneda: monedaNormalizada === 'USD' ? 'USD' : 'MXN',
      codigoProveedor: codigoFinal,
      nombreProveedor:
        f.proveedor?.nombre ||
        datosCatalogo?.nombre ||
        'Proveedor Desconocido',
      rfcEmisor,
      metodoPago: f.metodoPago,
      formaPago: f.formaPago,
      diasCredito: diasCreditoCalculados,
      fechaProgramacionPago: f.fechaEstimadaPago
        ? f.fechaEstimadaPago.split('T')[0]
        : '',
      fechaRevision: f.createdAt ? f.createdAt.split('T')[0] : '',
      total: Number(f.total),
      estado: f.estado || 'pendiente',
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
